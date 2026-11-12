import { Prisma, DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessError } from "@/lib/errors";
import { Permissions } from "@/lib/constants";
import { actionLabel, roleLabels } from "@/lib/display-labels";
import type { AuthContext } from "@/types/auth";
import type {
  AllowedAction,
  DocumentAction,
} from "@/modules/document/state-machine/types";
import { hasRolePermission, incomingScope, isAdmin, isCitizen } from "./access";

export const workflowInclude = {
  workflow: {
    include: {
      leader: { select: { id: true, fullName: true, employeeCode: true } },
      head: { select: { id: true, fullName: true, employeeCode: true } },
      unit: { select: { id: true, name: true } },
    },
  },
  handlers: true,
  files: true,
} satisfies Prisma.DocumentInclude;
export type IncomingDocument = Prisma.DocumentGetPayload<{
  include: typeof workflowInclude;
}>;
export const mayAttach = (ctx: AuthContext, doc: IncomingDocument) =>
  !doc.isLocked &&
  ((isCitizen(ctx) &&
    doc.creatorId === ctx.userId &&
    doc.status === "SUBMITTED") ||
    (hasRolePermission(ctx, "CLERK", Permissions.INCOMING_CREATE) &&
      ["SUBMITTED", "RECEIVED"].includes(doc.status)));
export const mayReport = (ctx: AuthContext, doc: IncomingDocument) =>
  doc.status === "PROCESSING" &&
  !doc.isLocked &&
  ctx.permissions.has(Permissions.INCOMING_PROCESS) &&
  (doc.handlers.some(
    (h) =>
      h.assigneeId === ctx.userId &&
      h.role !== "INFO" &&
      ["ASSIGNED", "PROCESSING", "RETURNED"].includes(h.status),
  ) ||
    (hasRolePermission(ctx, "SPECIALIST", Permissions.INCOMING_PROCESS) &&
      !doc.handlers.length));

export function incomingActions(
  ctx: AuthContext,
  doc: IncomingDocument,
): AllowedAction[] {
  if (doc.isLocked || isCitizen(ctx)) return [];
  const result: AllowedAction[] = [];
  const add = (
    action: DocumentAction,
    toStatus: DocumentStatus,
    requiresReason = false,
  ) =>
    result.push({
      action,
      toStatus,
      label: actionLabel(`DOC_${action}`),
      requiresReason,
      isOptimisticAllowed: false,
    });
  const leader =
    hasRolePermission(ctx, "LEADER", Permissions.INCOMING_ANNOTATE) &&
    (isAdmin(ctx) || doc.workflow?.leaderId === ctx.userId);
  const head =
    (hasRolePermission(ctx, "DEPT_HEAD", Permissions.INCOMING_ASSIGN) ||
      hasRolePermission(ctx, "LEADER", Permissions.INCOMING_ASSIGN)) &&
    (isAdmin(ctx) ||
      doc.workflow?.headId === ctx.userId ||
      doc.workflow?.leaderId === ctx.userId);

  const isLeader =
    isAdmin(ctx) ||
    ctx.roleCodes.includes("LEADER") ||
    hasRolePermission(ctx, "LEADER", Permissions.INCOMING_ANNOTATE) ||
    hasRolePermission(ctx, "LEADER", Permissions.INCOMING_COMPLETE);

  const isSpecialist =
    isAdmin(ctx) ||
    ctx.roleCodes.includes("SPECIALIST") ||
    ctx.roleCodes.includes("CLERK") ||
    hasRolePermission(ctx, "SPECIALIST", Permissions.INCOMING_PROCESS) ||
    hasRolePermission(ctx, "SPECIALIST", Permissions.INCOMING_FORWARD) ||
    hasRolePermission(ctx, "CLERK", Permissions.INCOMING_FORWARD);

  if (doc.status === "SUBMITTED" && isSpecialist) {
    add("RECEIVE_CITIZEN", "RECEIVED");
  }

  if (doc.status === "RECEIVED" && isSpecialist) {
    add("CLERK_DISTRIBUTE", "PROCESSING");
    add("SUBMIT_REVIEW", "PENDING_REVIEW");
    add("SUBMIT_LEADER", "PENDING_LEADER");
  }

  if (doc.status === "PENDING_LEADER" && (isLeader || leader)) {
    add("LEADER_ANNOTATE", "DISTRIBUTED", true);
    add("RETURN_CLERK", "RECEIVED", true);
  }

  if (doc.status === "DISTRIBUTED" && head) {
    add("DEPT_HEAD_ASSIGN", "PROCESSING");
    add("DEPT_HEAD_RETURN", "PENDING_LEADER", true);
  }

  const workers = doc.handlers.filter((h) => h.role !== "INFO");
  const allReported =
    !workers.length ||
    (workers.some((h) => h.role === "MAIN") &&
      workers.every((h) => ["REPORTED", "CONFIRMED"].includes(h.status)));

  if (doc.status === "PROCESSING" && allReported) {
    if (
      head ||
      isLeader ||
      (doc.handlers.some(
        (h) => h.assigneeId === ctx.userId && h.role === "MAIN",
      ) &&
        ctx.permissions.has(Permissions.INCOMING_PROCESS)) ||
      hasRolePermission(ctx, "SPECIALIST", Permissions.INCOMING_PROCESS)
    ) {
      add("SUBMIT_REVIEW", "PENDING_REVIEW");
    }
  }

  if (
    doc.status === "PENDING_REVIEW" &&
    (head || isLeader)
  ) {
    add("APPROVE_COMPLETE", "COMPLETED");
    add("REJECT_REPORT", "PROCESSING", true);
  }

  // Hồ sơ cũ từng bị đổi trạng thái mà chưa ghi người nhận: phục hồi có ghi lịch sử.
  if (
    isAdmin(ctx) &&
    ["DISTRIBUTED", "PROCESSING", "PENDING_REVIEW"].includes(doc.status) &&
    !doc.workflow?.headId &&
    !doc.handlers.length
  ) {
    add("RETURN_CLERK", "RECEIVED", true);
  }
  return result;
}

export async function lockedDocument(
  tx: Prisma.TransactionClient,
  ctx: AuthContext,
  id: string,
) {
  await tx.$queryRaw`SELECT id FROM documents WHERE id = ${id} FOR UPDATE`;
  const doc = await tx.document.findFirst({
    where: { AND: [{ id }, incomingScope(ctx)] },
    include: workflowInclude,
  });
  if (!doc)
    throw new BusinessError(
      "NOT_FOUND",
      "Không tìm thấy văn bản hoặc bạn không được giao quyền truy cập.",
    );
  return doc;
}
export async function audit(
  tx: Prisma.TransactionClient,
  ctx: AuthContext,
  doc: IncomingDocument,
  action: string,
  to: DocumentStatus,
  reason?: string,
) {
  await tx.auditLog.create({
    data: {
      actorId: ctx.userId,
      action: `DOC_${action}`,
      tableName: "documents",
      recordId: doc.id,
      oldState: { status: doc.status },
      newState: { status: to },
      reason: reason || actionLabel(`DOC_${action}`),
    },
  });
}
export async function notify(
  tx: Prisma.TransactionClient,
  ctx: AuthContext,
  documentId: string,
  recipients: (string | null | undefined)[],
  title: string,
  content: string,
) {
  const recipientIds = [
    ...new Set(
      recipients.filter((id): id is string => !!id && id !== ctx.userId),
    ),
  ];
  if (recipientIds.length)
    await tx.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        recipientId,
        actorId: ctx.userId,
        documentId,
        title,
        content,
        type: "DOC_ASSIGNED" as const,
      })),
    });
}
export async function requireRecipient(
  tx: Prisma.TransactionClient,
  userId: string | undefined,
  role: string,
  unitId?: string,
) {
  if (!userId)
    throw new BusinessError("VALIDATION_ERROR", "Vui lòng chọn người nhận.");
  const user = await tx.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      positions: {
        some: {
          startedAt: { lte: new Date() },
          endedAt: null,
          ...(unitId
            ? {
                OR: [
                  { unitId },
                  { unit: { level: 0 } },
                ],
              }
            : {}),
          unit: { isActive: true },
          position: { isActive: true },
          roles: {
            some: {
              role: {
                code:
                  role === "DEPT_HEAD"
                    ? { in: ["DEPT_HEAD", "LEADER", "SPECIALIST"] }
                    : role,
                isActive: true,
              },
            },
          },
        },
      },
    },
  });
  if (!user)
    throw new BusinessError(
      "VALIDATION_ERROR",
      "Người nhận không có vai trò hoặc phòng ban phù hợp.",
    );
  return user;
}
export async function nextIncomingNumber(
  tx: Prisma.TransactionClient,
  bookId: string,
  year: number,
) {
  const book = await tx.documentBook.findFirst({
    where: { id: bookId, bookType: "INCOMING", isActive: true },
  });
  if (!book)
    throw new BusinessError("VALIDATION_ERROR", "Sổ văn bản đến không hợp lệ.");
  const counter = await tx.documentBookCounter.upsert({
    where: { bookId_year: { bookId, year } },
    create: { bookId, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return {
    documentBookId: bookId,
    documentNumberYear: year,
    documentOrder: counter.lastNumber,
    documentNumber: (book.numberTemplate || "{number}").replace(
      "{number}",
      String(counter.lastNumber).padStart(2, "0"),
    ),
  };
}

type TransitionInput = {
  action: DocumentAction;
  reason?: string;
  leaderId?: string;
  headId?: string;
  unitId?: string;
  documentBookId?: string;
  processingDeadline?: Date | null;
};
export async function transitionIncoming(
  ctx: AuthContext,
  id: string,
  input: TransitionInput,
) {
  return prisma.$transaction(async (tx) => {
    const doc = await lockedDocument(tx, ctx, id);
    const action = incomingActions(ctx, doc).find(
      (a) => a.action === input.action,
    );
    if (!action || input.action === "DEPT_HEAD_ASSIGN")
      throw new BusinessError(
        "FORBIDDEN",
        "Bạn không được thực hiện thao tác này ở bước hiện tại.",
      );
    if (action.requiresReason && !input.reason?.trim())
      throw new BusinessError(
        "VALIDATION_ERROR",
        "Vui lòng nhập ý kiến hoặc lý do.",
      );
    let recipients: (string | null | undefined)[] = [];
    let reason = input.reason?.trim();
    const data: Prisma.DocumentUpdateInput = { status: action.toStatus };
    if (input.action === "RECEIVE_CITIZEN") {
      if (!input.documentBookId)
        throw new BusinessError(
          "VALIDATION_ERROR",
          "Vui lòng chọn sổ văn bản đến.",
        );
      const numbering = await nextIncomingNumber(
        tx,
        input.documentBookId,
        new Date().getFullYear(),
      );
      Object.assign(data, {
        documentNumber: numbering.documentNumber,
        documentNumberYear: numbering.documentNumberYear,
        documentOrder: numbering.documentOrder,
        documentBook: { connect: { id: numbering.documentBookId } },
        receivedDate: new Date(),
      });
      await tx.incomingWorkflow.update({
        where: { documentId: id },
        data: { registrarId: ctx.userId },
      });
      recipients = [doc.creatorId];
    } else if (input.action === "CLERK_DISTRIBUTE") {
      if (!doc.documentNumber || !doc.documentBookId)
        throw new BusinessError(
          "VALIDATION_ERROR",
          "Cần vào sổ văn bản trước khi phân phối.",
        );
      const unitId =
        input.unitId ||
        ctx.primaryPosition?.unitId ||
        (await tx.unit.findFirst({ where: { isActive: true, level: { gt: 0 } } }))?.id ||
        (await tx.unit.findFirst({ where: { isActive: true } }))?.id;
      if (!unitId)
        throw new BusinessError(
          "VALIDATION_ERROR",
          "Vui lòng chọn phòng ban xử lý.",
        );
      const specialist = await requireRecipient(
        tx,
        input.headId || ctx.userId,
        "SPECIALIST",
        unitId,
      );
      // Gán lãnh đạo cơ quan phê duyệt mặc định nếu chưa gán
      let leaderId = doc.workflow?.leaderId;
      if (!leaderId) {
        const defaultLeader = await tx.user.findFirst({
          where: {
            isActive: true,
            positions: {
              some: {
                startedAt: { lte: new Date() },
                endedAt: null,
                roles: { some: { role: { code: "LEADER", isActive: true } } },
              },
            },
          },
        });
        if (defaultLeader) leaderId = defaultLeader.id;
      }
      // Gán Trưởng phòng đơn vị
      const unitHead = await tx.user.findFirst({
        where: {
          isActive: true,
          positions: {
            some: {
              unitId,
              roles: { some: { role: { code: { in: ["LEADER", "DEPT_HEAD"] }, isActive: true } } },
            },
          },
        },
      });

      await tx.incomingWorkflow.upsert({
        where: { documentId: id },
        create: {
          documentId: id,
          registrarId: ctx.userId,
          leaderId: leaderId || undefined,
          headId: unitHead?.id || specialist.id,
          unitId,
          instruction: reason || "Chuyên viên chủ trì giải quyết hồ sơ đúng hạn.",
        },
        update: {
          registrarId: ctx.userId,
          ...(leaderId ? { leaderId } : {}),
          headId: unitHead?.id || specialist.id,
          unitId,
          instruction: reason || "Chuyên viên chủ trì giải quyết hồ sơ đúng hạn.",
        },
      });

      const deadline = input.processingDeadline || doc.processingDeadline;
      // Gán Handler cho Chuyên viên thụ lý để vào thẳng PROCESSING
      await tx.documentHandler.deleteMany({ where: { documentId: id } });
      await tx.documentHandler.create({
        data: {
          documentId: id,
          assignerId: ctx.userId,
          assigneeId: specialist.id,
          unitId,
          role: "MAIN",
          deadline,
          instruction: reason || "Chuyên viên chủ trì xử lý hồ sơ và báo cáo kết quả trình Lãnh đạo phê duyệt.",
        },
      });

      data.processingDeadline = deadline;
      data.status = "PROCESSING";
      recipients = [specialist.id];
      reason = `Chuyên viên ${specialist.fullName} (${specialist.employeeCode}) chủ trì thụ lý giải quyết: ${reason || "Xử lý theo quy định"}`;
    } else if (input.action === "SUBMIT_LEADER") {
      if (!doc.documentNumber || !doc.documentBookId || !doc.files.length)
        throw new BusinessError(
          "VALIDATION_ERROR",
          "Cần vào sổ và đính kèm tệp gốc trước khi trình lãnh đạo.",
        );
      const leader = await requireRecipient(tx, input.leaderId, "LEADER");
      await tx.incomingWorkflow.upsert({
        where: { documentId: id },
        create: {
          documentId: id,
          leaderId: leader.id,
          registrarId: ctx.userId,
        },
        update: {
          leaderId: leader.id,
          registrarId: ctx.userId,
          headId: null,
          unitId: null,
          instruction: null,
        },
      });
      recipients = [leader.id];
      reason = `Trình lãnh đạo ${leader.fullName}. ${reason || ""}`;
    } else if (input.action === "LEADER_ANNOTATE") {
      if (!input.unitId)
        throw new BusinessError(
          "VALIDATION_ERROR",
          "Vui lòng chọn phòng ban xử lý.",
        );
      const head = await requireRecipient(
        tx,
        input.headId,
        "DEPT_HEAD",
        input.unitId,
      );
      await tx.incomingWorkflow.update({
        where: { documentId: id },
        data: { headId: head.id, unitId: input.unitId, instruction: reason },
      });
      data.processingDeadline =
        input.processingDeadline || doc.processingDeadline;
      recipients = [head.id];
      reason = `Giao trưởng phòng ${head.fullName}: ${reason}`;
    } else if (input.action === "RETURN_CLERK") {
      recipients = [doc.workflow?.registrarId || doc.creatorId];
      if (doc.workflow)
        await tx.incomingWorkflow.update({
          where: { documentId: id },
          data: { headId: null, unitId: null },
        });
    } else if (input.action === "DEPT_HEAD_RETURN") {
      recipients = [doc.workflow?.leaderId];
      await tx.incomingWorkflow.update({
        where: { documentId: id },
        data: { headId: null, unitId: null },
      });
    } else if (input.action === "SUBMIT_REVIEW") {
      let leaderId = doc.workflow?.leaderId;
      if (!leaderId) {
        const defaultLeader = await tx.user.findFirst({
          where: {
            isActive: true,
            positions: {
              some: {
                startedAt: { lte: new Date() },
                endedAt: null,
                roles: { some: { role: { code: "LEADER", isActive: true } } },
              },
            },
          },
        });
        if (defaultLeader) leaderId = defaultLeader.id;
      }
      if (doc.workflow) {
        await tx.incomingWorkflow.update({
          where: { documentId: id },
          data: {
            leaderId: leaderId || undefined,
            instruction: reason || doc.workflow.instruction || "Chuyên viên đã kiểm tra hồ sơ và trình Lãnh đạo phê duyệt.",
          },
        });
      }
      if (!doc.handlers.length) {
        await tx.documentHandler.create({
          data: {
            documentId: id,
            assigneeId: ctx.userId,
            assignerId: ctx.userId,
            role: "MAIN",
            status: "REPORTED",
            reportContent: reason || "Hồ sơ hợp lệ, Chuyên viên kính trình Lãnh đạo xem xét phê duyệt.",
            completedAt: new Date(),
          },
        });
      } else {
        await tx.documentHandler.updateMany({
          where: {
            documentId: id,
            role: { not: "INFO" },
            status: { in: ["ASSIGNED", "PROCESSING"] },
          },
          data: { status: "REPORTED", completedAt: new Date() },
        });
      }
      recipients = [leaderId, doc.creatorId];
      reason = reason || `Chuyên viên ${ctx.fullName} trình Lãnh đạo xem xét phê duyệt hồ sơ`;
    } else if (input.action === "REJECT_REPORT") {
      await tx.documentHandler.updateMany({
        where: { documentId: id, role: { not: "INFO" } },
        data: { status: "RETURNED", completedAt: null },
      });
      data.status = "PROCESSING";
      recipients = doc.handlers
        .filter((h) => h.role !== "INFO")
        .map((h) => h.assigneeId);
      if (doc.workflow?.registrarId) recipients.push(doc.workflow.registrarId);
      reason = reason || "Lãnh đạo yêu cầu bổ sung / xử lý lại hồ sơ";
    } else if (input.action === "APPROVE_COMPLETE") {
      await tx.documentHandler.updateMany({
        where: { documentId: id, role: { not: "INFO" } },
        data: { status: "CONFIRMED" },
      });
      data.isLocked = true;
      if (doc.workflow) {
        await tx.incomingWorkflow.update({
          where: { documentId: id },
          data: {
            leaderId: ctx.userId,
            instruction: reason || doc.workflow.instruction || "Đã phê duyệt hoàn tất và trả kết quả cho Người dân.",
          },
        });
      }
      recipients = [
        doc.creatorId,
        doc.workflow?.registrarId,
        doc.workflow?.leaderId,
        ctx.userId,
        ...doc.handlers.map((h) => h.assigneeId),
      ];
      reason = reason || `Lãnh đạo ${ctx.fullName} đã duyệt đơn và hoàn tất giải quyết`;
    }
    const updated = await tx.document.update({ where: { id }, data });
    await audit(tx, ctx, doc, input.action, action.toStatus, reason);
    await notify(
      tx,
      ctx,
      id,
      recipients,
      action.label,
      `Văn bản “${doc.title}”: ${reason || action.label}`,
    );
    return updated;
  });
}

export async function reportIncoming(
  ctx: AuthContext,
  id: string,
  content: string,
) {
  if (content.trim().length < 5)
    throw new BusinessError("VALIDATION_ERROR", "Báo cáo cần ít nhất 5 ký tự.");
  return prisma.$transaction(async (tx) => {
    const doc = await lockedDocument(tx, ctx, id);
    if (!mayReport(ctx, doc))
      throw new BusinessError(
        "FORBIDDEN",
        "Bạn không có nhiệm vụ cần báo cáo ở bước hiện tại.",
      );
    let handler = doc.handlers.find(
      (h) => h.assigneeId === ctx.userId && h.role !== "INFO",
    );
    if (!handler) {
      handler = await tx.documentHandler.create({
        data: {
          documentId: id,
          assigneeId: ctx.userId,
          assignerId: ctx.userId,
          role: "MAIN",
          instruction: "Chuyên viên thụ lý giải quyết",
        },
      });
    }
    const updated = await tx.documentHandler.update({
      where: { id: handler.id },
      data: {
        status: "REPORTED",
        reportContent: content.trim(),
        completedAt: new Date(),
      },
    });
    await audit(
      tx,
      ctx,
      doc,
      "HANDLER_REPORT",
      doc.status,
      `${roleLabels[handler.role]} báo cáo: ${content.trim()}`,
    );
    await notify(
      tx,
      ctx,
      id,
      [
        doc.workflow?.headId,
        ...doc.handlers
          .filter((h) => h.role === "MAIN")
          .map((h) => h.assigneeId),
      ],
      "Đã có báo cáo xử lý",
      `${ctx.fullName} đã báo cáo kết quả văn bản “${doc.title}”.`,
    );
    return updated;
  });
}
