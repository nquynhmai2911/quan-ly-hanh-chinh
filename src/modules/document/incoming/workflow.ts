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
  doc.handlers.some(
    (h) =>
      h.assigneeId === ctx.userId &&
      h.role !== "INFO" &&
      ["ASSIGNED", "PROCESSING", "RETURNED"].includes(h.status),
  );

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
  const clerk = hasRolePermission(ctx, "CLERK", Permissions.INCOMING_FORWARD);
  const leader =
    hasRolePermission(ctx, "LEADER", Permissions.INCOMING_ANNOTATE) &&
    (isAdmin(ctx) || doc.workflow?.leaderId === ctx.userId);
  const head =
    (hasRolePermission(ctx, "DEPT_HEAD", Permissions.INCOMING_ASSIGN) ||
      hasRolePermission(ctx, "LEADER", Permissions.INCOMING_ASSIGN)) &&
    (isAdmin(ctx) ||
      doc.workflow?.headId === ctx.userId ||
      doc.workflow?.leaderId === ctx.userId);
  if (
    doc.status === "SUBMITTED" &&
    hasRolePermission(ctx, "CLERK", Permissions.INCOMING_REGISTER)
  )
    add("RECEIVE_CITIZEN", "RECEIVED");
  if (doc.status === "RECEIVED" && clerk)
    add("SUBMIT_LEADER", "PENDING_LEADER");
  if (doc.status === "PENDING_LEADER" && leader) {
    add("LEADER_ANNOTATE", "DISTRIBUTED", true);
    add("RETURN_CLERK", "RECEIVED", true);
  }
  if (doc.status === "DISTRIBUTED" && head) {
    add("DEPT_HEAD_ASSIGN", "PROCESSING");
    add("DEPT_HEAD_RETURN", "PENDING_LEADER", true);
  }
  const workers = doc.handlers.filter((h) => h.role !== "INFO");
  const allReported =
    workers.length > 0 &&
    workers.some((h) => h.role === "MAIN") &&
    workers.every((h) => ["REPORTED", "CONFIRMED"].includes(h.status));
  if (
    doc.status === "PROCESSING" &&
    allReported &&
    (head ||
      (doc.handlers.some(
        (h) => h.assigneeId === ctx.userId && h.role === "MAIN",
      ) &&
        ctx.permissions.has(Permissions.INCOMING_PROCESS)))
  )
    add("SUBMIT_REVIEW", "PENDING_REVIEW");
  if (
    doc.status === "PENDING_REVIEW" &&
    (head || leader || isAdmin(ctx)) &&
    (isAdmin(ctx) || ctx.permissions.has(Permissions.INCOMING_COMPLETE))
  ) {
    if (allReported) add("APPROVE_COMPLETE", "COMPLETED");
    add("REJECT_REPORT", "PROCESSING", true);
  }
  // Hồ sơ cũ từng bị đổi trạng thái mà chưa ghi người nhận: phục hồi có ghi lịch sử.
  if (
    isAdmin(ctx) &&
    ["DISTRIBUTED", "PROCESSING", "PENDING_REVIEW"].includes(doc.status) &&
    !doc.workflow?.headId &&
    !doc.handlers.length
  )
    add("RETURN_CLERK", "RECEIVED", true);
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
      if (!doc.workflow?.headId)
        throw new BusinessError(
          "CONFLICT",
          "Hồ sơ chưa có trưởng phòng chịu trách nhiệm duyệt.",
        );
      recipients = [doc.workflow.headId];
    } else if (input.action === "REJECT_REPORT") {
      await tx.documentHandler.updateMany({
        where: { documentId: id, role: { not: "INFO" } },
        data: { status: "RETURNED", completedAt: null },
      });
      recipients = doc.handlers
        .filter((h) => h.role !== "INFO")
        .map((h) => h.assigneeId);
    } else if (input.action === "APPROVE_COMPLETE") {
      await tx.documentHandler.updateMany({
        where: { documentId: id, role: { not: "INFO" } },
        data: { status: "CONFIRMED" },
      });
      data.isLocked = true;
      recipients = [
        doc.creatorId,
        doc.workflow?.registrarId,
        doc.workflow?.leaderId,
        ...doc.handlers.map((h) => h.assigneeId),
      ];
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
    const handler = doc.handlers.find(
      (h) => h.assigneeId === ctx.userId && h.role !== "INFO",
    )!;
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
