// src/modules/document/state-machine/index.ts
// State Machine Service một cửa: Hàm thuần kiểm tra quyền & Hàm thực thi transaction an toàn

import {
  PrismaClient,
  DocumentDirection,
  DocumentStatus,
  Prisma,
} from "@prisma/client";
import { incomingTransitions } from "./incoming-transitions";
import { outgoingTransitions } from "./outgoing-transitions";
import {
  AllowedAction,
  DocumentAction,
  ExecuteTransitionInput,
  StateMachineContext,
  TransitionRule,
} from "./types";
import { createHash } from "node:crypto";
import { defaultStorageProvider } from "@/lib/storage";
import { documentStatusLabels } from "@/lib/display-labels";
import { BusinessError } from "@/lib/errors";

export * from "./types";
export * from "./incoming-transitions";
export * from "./outgoing-transitions";

/**
 * Lấy danh sách luật chuyển trạng thái theo chiều văn bản
 */
export function getRulesByDirection(
  direction: DocumentDirection,
): TransitionRule[] {
  return direction === "INCOMING" ? incomingTransitions : outgoingTransitions;
}

/**
 * Tìm luật chuyển trạng thái cụ thể
 */
export function findTransitionRule(
  direction: DocumentDirection,
  fromStatus: DocumentStatus,
  action: DocumentAction,
): TransitionRule | undefined {
  const rules = getRulesByDirection(direction);
  return rules.find((r) => r.from === fromStatus && r.action === action);
}

/**
 * Hàm thuần: Kiểm tra xem một hành động chuyển trạng thái có hợp lệ trong ngữ cảnh hay không
 */
export function canTransition(
  direction: DocumentDirection,
  fromStatus: DocumentStatus,
  action: DocumentAction,
  ctx: StateMachineContext,
): { allowed: boolean; rule?: TransitionRule; reason?: string } {
  const rule = findTransitionRule(direction, fromStatus, action);
  if (!rule) {
    return {
      allowed: false,
      reason: "Thao tác không hợp lệ ở bước hiện tại.",
    };
  }

  // 1. Kiểm tra văn bản có bị khóa không
  if (ctx.document.isLocked && action !== "RECALL" && action !== "REPLACE") {
    return {
      allowed: false,
      rule,
      reason:
        "Văn bản đã ban hành và bị khóa, không thể thay đổi trạng thái này.",
    };
  }

  // 2. Kiểm tra quyền (Permission)
  const hasPermission =
    ctx.roles.includes("ADMIN") ||
    ctx.permissions.includes(rule.requiredPermission);
  if (!hasPermission) {
    return {
      allowed: false,
      rule,
      reason: "Bạn không có quyền thực hiện thao tác này.",
    };
  }

  // 3. Kiểm tra vai trò (Role)
  const hasRole =
    ctx.roles.includes("ADMIN") ||
    ctx.roles.some((r) => rule.allowedRoles.includes(r));
  if (!hasRole) {
    return {
      allowed: false,
      rule,
      reason: "Vai trò của bạn không được thực hiện thao tác này.",
    };
  }

  if (direction === "OUTGOING" && !ctx.roles.includes("ADMIN")) {
    const actorIsCreator = ctx.document.creatorId === ctx.userId;
    const actorIsReviewer = ctx.additionalData?.reviewerId === ctx.userId;
    const actorIsApprover = ctx.additionalData?.approverId === ctx.userId;
    if (
      (["SUBMIT_FOR_REVIEW", "RESUBMIT"].includes(action) && !actorIsCreator) ||
      (["REVIEW_APPROVE", "REVIEW_REJECT"].includes(action) &&
        !actorIsReviewer) ||
      (["LEADER_APPROVE", "LEADER_REJECT", "RECALL", "REPLACE"].includes(
        action,
      ) &&
        !actorIsApprover) ||
      (action === "CANCEL" &&
        !actorIsCreator &&
        !actorIsReviewer &&
        !actorIsApprover)
    ) {
      return {
        allowed: false,
        rule,
        reason: "Văn bản chưa được giao cho bạn thực hiện thao tác này.",
      };
    }
  }

  // 4. Kiểm tra điều kiện nghiệp vụ bổ sung (nếu có)
  if (rule.condition && !rule.condition(ctx)) {
    return {
      allowed: false,
      rule,
      reason:
        rule.conditionDescriptionVi ||
        "Không thỏa mãn điều kiện nghiệp vụ của bước này.",
    };
  }

  return { allowed: true, rule };
}

/**
 * Hàm thuần: Lấy danh sách các nút thao tác hợp lệ để UI hiển thị
 */
export function getAllowedActions(
  direction: DocumentDirection,
  currentStatus: DocumentStatus,
  ctx: StateMachineContext,
): AllowedAction[] {
  const rules = getRulesByDirection(direction).filter(
    (r) => r.from === currentStatus,
  );
  const result: AllowedAction[] = [];

  for (const rule of rules) {
    const check = canTransition(direction, currentStatus, rule.action, ctx);
    if (check.allowed) {
      result.push({
        action: rule.action,
        label: rule.labelVi,
        toStatus: rule.to,
        requiresReason: !!rule.requiresReason,
        isOptimisticAllowed: rule.isOptimisticAllowed,
      });
    }
  }

  return result;
}

/**
 * Dịch vụ cốt lõi: Thực thi chuyển trạng thái trong DUY NHẤT MỘT transaction
 * Bao gồm:
 * 1. Validate trạng thái & điều kiện
 * 2. Cập nhật trạng thái Document
 * 3. Nếu là cấp số: chạy locking atomic counter
 * 4. Ghi AuditLog bất biến
 * 5. Tạo Notification tự động
 */
export async function executeDocumentTransition(
  prisma: PrismaClient,
  input: ExecuteTransitionInput,
  ctx: StateMachineContext,
) {
  const { documentId, action, actorId, reason, ipAddress, userAgent } = input;

  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM documents WHERE id = ${documentId} FOR UPDATE`;
    // Đọc và kiểm tra trong cùng giao dịch đã khóa văn bản.
    const doc = await tx.document.findUnique({
      where: { id: documentId },
      include: {
        documentBook: true,
        approvals: true,
        signatures: true,
        handlers: true,
        files: { where: { isCurrent: true } },
      },
    });

    if (!doc) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản.");
    }

    // Cập nhật context với trạng thái mới nhất từ DB
    ctx.document = {
      id: doc.id,
      direction: doc.direction,
      status: doc.status,
      creatorId: doc.creatorId,
      draftUnitId: doc.draftUnitId,
      isLocked: doc.isLocked,
      documentNumber: doc.documentNumber,
    };

    // Nạp thông tin kiểm tra điều kiện
    const mainHandlers = doc.handlers.filter((h) => h.role === "MAIN");
    const allMainReported =
      mainHandlers.length > 0 &&
      mainHandlers.every(
        (h) => h.status === "REPORTED" || h.status === "CONFIRMED",
      );

    ctx.additionalData = {
      ...ctx.additionalData,
      allMainHandlersReported: allMainReported,
      hasFile: doc.files.length > 0,
      reviewerId: doc.approvals.find((a) => a.role === "REVIEWER")?.approverId,
      approverId: doc.approvals.find((a) => a.role === "APPROVER")?.approverId,
      reason,
    };

    // Kiểm tra tính hợp lệ
    const check = canTransition(doc.direction, doc.status, action, ctx);
    if (!check.allowed || !check.rule) {
      throw new BusinessError("INVALID_TRANSITION", check.reason);
    }

    const rule = check.rule;

    // Nếu bắt buộc lý do mà không có
    if (rule.requiresReason && (!reason || reason.trim().length === 0)) {
      throw new BusinessError(
        "VALIDATION_ERROR",
        `Thao tác '${rule.labelVi}' bắt buộc phải nhập lý do cụ thể.`,
      );
    }

    // Mọi thay đổi và phê duyệt cùng một giao dịch.
    let newDocumentNumber = doc.documentNumber;
    let newOrder = doc.documentOrder;
    let newYear = doc.documentNumberYear;
    let newIssuedDate = doc.issuedDate;
    const isLocked = rule.to === "ISSUED" ? true : doc.isLocked;

    // ── XỬ LÝ ĐẶC THÙ: CẤP SỐ VĂN BẢN AN TOÀN ─────────────────────────────
    if (action === "REGISTER_NUMBER") {
      if (!doc.documentBookId) {
        throw new BusinessError(
          "VALIDATION_ERROR",
          "Văn bản chưa được gán vào sổ văn bản.",
        );
      }

      const currentYear = new Date().getFullYear();

      // Sử dụng raw query để khóa dòng bộ đếm theo sổ và năm (SELECT ... FOR UPDATE)
      const counters = await tx.$queryRaw<
        Array<{ id: string; last_number: number }>
      >`SELECT id, last_number FROM document_book_counters WHERE book_id = ${doc.documentBookId} AND year = ${currentYear} FOR UPDATE`;

      let lastNumber = 0;
      let counterId = "";

      if (counters.length === 0) {
        // Nếu chưa có bộ đếm cho năm hiện tại, khởi tạo
        const createdCounter = await tx.documentBookCounter.create({
          data: {
            bookId: doc.documentBookId,
            year: currentYear,
            lastNumber: 1,
          },
        });
        lastNumber = 1;
        counterId = createdCounter.id;
      } else {
        lastNumber = counters[0].last_number + 1;
        counterId = counters[0].id;
        await tx.documentBookCounter.update({
          where: { id: counterId },
          data: { lastNumber },
        });
      }

      newOrder = lastNumber;
      newYear = currentYear;
      newIssuedDate = new Date();

      // Định dạng số văn bản theo template của sổ
      const book = await tx.documentBook.findUnique({
        where: { id: doc.documentBookId },
        include: { unit: true, documentType: true },
      });

      const typeCode = book?.documentType?.code || "VB";
      const unitCode = book?.unit?.code || "CQ";
      const template = book?.numberTemplate || "{number}/{typeCode}-{unitCode}";

      newDocumentNumber = template
        .replace("{number}", String(newOrder).padStart(2, "0"))
        .replace("{typeCode}", typeCode)
        .replace("{unitCode}", unitCode);
    }

    if (["SUBMIT_FOR_REVIEW", "RESUBMIT"].includes(action)) {
      if (
        !doc.files.length ||
        !doc.approvals.some((a) => a.role === "REVIEWER") ||
        !doc.approvals.some((a) => a.role === "APPROVER")
      )
        throw new BusinessError(
          "VALIDATION_ERROR",
          "Cần tệp dự thảo và đủ người duyệt trước khi trình.",
        );
      await tx.documentApproval.updateMany({
        where: { documentId },
        data: { status: "PENDING", actionAt: null, comment: null },
      });
    }
    if (
      [
        "REVIEW_APPROVE",
        "REVIEW_REJECT",
        "LEADER_APPROVE",
        "LEADER_REJECT",
      ].includes(action)
    ) {
      const role = action.startsWith("REVIEW") ? "REVIEWER" : "APPROVER";
      const step = doc.approvals.find((a) => a.role === role);
      if (!step)
        throw new BusinessError(
          "VALIDATION_ERROR",
          "Chưa cấu hình người duyệt văn bản.",
        );
      await tx.documentApproval.update({
        where: { id: step.id },
        data: {
          status: action.endsWith("APPROVE") ? "APPROVED" : "REJECTED",
          actionAt: new Date(),
          comment: reason || null,
        },
      });
    }
    if (action === "LEADER_APPROVE") {
      if (!doc.files.length)
        throw new BusinessError(
          "VALIDATION_ERROR",
          "Chưa có tệp dự thảo để phê duyệt.",
        );
      for (const file of doc.files) {
        const buffer = await defaultStorageProvider.readFile(file.fileKey);
        if (createHash("sha256").update(buffer).digest("hex") !== file.fileHash)
          throw new BusinessError(
            "CONFLICT",
            "Tệp đã thay đổi, không thể phê duyệt.",
          );
        await tx.documentSignature.create({
          data: {
            documentId,
            fileId: file.id,
            signerId: actorId,
            fileHash: file.fileHash,
            signatureType: "ELECTRONIC_APPROVAL",
          },
        });
      }
    }

    if (
      ["REGISTER_NUMBER", "ISSUE"].includes(action) &&
      (!doc.files.length ||
        doc.files.some(
          (f) =>
            !doc.signatures.some(
              (sig) => sig.fileId === f.id && sig.fileHash === f.fileHash,
            ),
        ))
    )
      throw new BusinessError(
        "CONFLICT",
        "Các tệp cần được phê duyệt đầy đủ trước khi cấp số hoặc ban hành.",
      );
    if (action === "ISSUE") {
      for (const file of doc.files) {
        const buffer = await defaultStorageProvider.readFile(file.fileKey);
        if (createHash("sha256").update(buffer).digest("hex") !== file.fileHash)
          throw new BusinessError(
            "CONFLICT",
            "Tệp không còn khớp với bản đã phê duyệt.",
          );
      }
    }

    // ── CẬP NHẬT TRẠNG THÁI DOCUMENT ───────────────────────────────────────
    const updatedDoc = await tx.document.update({
      where: { id: documentId },
      data: {
        status: rule.to,
        ...(action === "LEADER_APPROVE"
          ? {
              signerName: (
                await tx.user.findUniqueOrThrow({
                  where: { id: actorId },
                  select: { fullName: true },
                })
              ).fullName,
            }
          : {}),
        isLocked,
        documentNumber: newDocumentNumber,
        documentOrder: newOrder,
        documentNumberYear: newYear,
        issuedDate: newIssuedDate,
        cancellationReason:
          rule.to === "RECALLED" ||
          rule.to === "REPLACED" ||
          rule.to === "CANCELLED"
            ? reason
            : doc.cancellationReason,
      },
    });

    // ── GHI NHẬT KÝ KIỂM TOÁN AUDIT LOG (BẤT BIẾN) ─────────────────────────
    await tx.auditLog.create({
      data: {
        actorId,
        action: `DOC_${action}`,
        tableName: "documents",
        recordId: documentId,
        oldState: {
          status: doc.status,
          documentNumber: doc.documentNumber,
          isLocked: doc.isLocked,
        } as Prisma.InputJsonValue,
        newState: {
          status: rule.to,
          documentNumber: newDocumentNumber,
          isLocked,
        } as Prisma.InputJsonValue,
        reason: reason || `Thực hiện ${rule.labelVi}`,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    // ── TẠO THÔNG BÁO TỰ ĐỘNG CHO ĐỐI TƯỢNG LIÊN QUAN ─────────────────────
    if (rule.notifyTargetRole && rule.notifyTargetRole.length > 0) {
      // Tìm danh sách người dùng thuộc vai trò mục tiêu
      const targetUsers = await tx.userPositionRole.findMany({
        where: {
          role: { code: { in: rule.notifyTargetRole } },
          userPosition: { endedAt: null },
        },
        select: {
          userPosition: { select: { userId: true } },
        },
      });

      let recipientIds = Array.from(
        new Set(
          targetUsers
            .map((u) => u.userPosition.userId)
            .filter((uid) => uid !== actorId), // Không tự gửi thông báo cho chính mình
        ),
      );

      if (["SUBMIT_FOR_REVIEW", "RESUBMIT"].includes(action))
        recipientIds = doc.approvals
          .filter((a) => a.role === "REVIEWER")
          .map((a) => a.approverId);
      if (action === "REVIEW_APPROVE")
        recipientIds = doc.approvals
          .filter((a) => a.role === "APPROVER")
          .map((a) => a.approverId);
      if (["REVIEW_REJECT", "LEADER_REJECT"].includes(action))
        recipientIds = [doc.creatorId];
      recipientIds = [...new Set(recipientIds)].filter((id) => id !== actorId);
      for (const recipientId of recipientIds) {
        await tx.notification.create({
          data: {
            recipientId,
            actorId,
            type:
              rule.to === "RETURNED"
                ? "DOC_RETURNED"
                : rule.to === "COMPLETED" || rule.to === "ISSUED"
                  ? "DOC_COMPLETED"
                  : "DOC_APPROVAL_REQUEST",
            title:
              rule.notifyTitleTemplate || `Cập nhật văn bản: ${rule.labelVi}`,
            content: `Văn bản "${doc.title}" đã chuyển sang trạng thái: ${documentStatusLabels[rule.to] || "Đã cập nhật"}. ${
              reason ? `Ghi chú: ${reason}` : ""
            }`,
            documentId: doc.id,
          },
        });
      }
    }

    return updatedDoc;
  });
}
