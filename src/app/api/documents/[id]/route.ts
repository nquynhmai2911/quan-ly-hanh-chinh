// src/app/api/documents/[id]/route.ts
// API Chi tiết, Cập nhật thông tin (Sửa) và Xóa văn bản (Cả văn bản đến & văn bản đi)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { z } from "zod";
import { documentScope } from "@/modules/document/access";

const updateDocumentSchema = z.object({
  title: z.string().trim().min(3, "Trích yếu phải từ 3 ký tự trở lên.").max(1000).optional(),
  documentNumber: z.string().trim().nullable().optional(),
  originalCode: z.string().trim().nullable().optional(),
  senderName: z.string().trim().nullable().optional(),
  recipientsSummary: z.string().trim().nullable().optional(),
  signerName: z.string().trim().nullable().optional(),
  signerPosition: z.string().trim().nullable().optional(),
  urgency: z.enum(["NORMAL", "URGENT", "FIRE"]).optional(),
  security: z.enum(["NORMAL", "CONFIDENTIAL", "TOP_SECRET"]).optional(),
  issuedDate: z.string().nullable().optional(),
  processingDeadline: z.string().nullable().optional(),
  summaryNotes: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;

    const doc = await prisma.document.findFirst({
      where: { AND: [{ id }, await documentScope(ctx)] },
      include: {
        documentBook: true,
        documentType: true,
        senderOrg: true,
        draftUnit: true,
        creator: { select: { id: true, fullName: true, employeeCode: true } },
        workflow: {
          include: {
            leader: { select: { id: true, fullName: true } },
            head: { select: { id: true, fullName: true } },
            unit: { select: { id: true, name: true } },
          },
        },
        handlers: {
          include: {
            assignee: { select: { id: true, fullName: true } },
            unit: { select: { id: true, name: true } },
          },
          orderBy: { assignedAt: "asc" },
        },
        approvals: {
          include: { approver: { select: { id: true, fullName: true } } },
          orderBy: { stepOrder: "asc" },
        },
        files: { where: { isCurrent: true } },
      },
    });

    if (!doc) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản.");
    }

    return successResponse({ document: doc });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản.");

    // Kiểm tra quyền: Admin, người tạo, hoặc nhân sự công vụ
    const isStaff = ctx.roleCodes.some((r) =>
      ["ADMIN", "LEADER", "SPECIALIST"].includes(r),
    );
    if (!isStaff && doc.creatorId !== ctx.userId) {
      throw new BusinessError("FORBIDDEN", "Bạn không có quyền chỉnh sửa văn bản này.");
    }

    const json = await request.json();
    const parsed = updateDocumentSchema.safeParse(json);
    if (!parsed.success) {
      throw new BusinessError("VALIDATION_ERROR", parsed.error.issues[0]?.message);
    }

    const { issuedDate, processingDeadline, ...fields } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.document.update({
        where: { id },
        data: {
          ...fields,
          ...(issuedDate !== undefined
            ? { issuedDate: issuedDate ? new Date(issuedDate) : null }
            : {}),
          ...(processingDeadline !== undefined
            ? { processingDeadline: processingDeadline ? new Date(processingDeadline) : null }
            : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: ctx.userId,
          action: "DOC_UPDATE",
          tableName: "documents",
          recordId: id,
          oldState: {
            title: doc.title,
            documentNumber: doc.documentNumber,
            originalCode: doc.originalCode,
          },
          newState: {
            title: result.title,
            documentNumber: result.documentNumber,
            originalCode: result.originalCode,
          },
          reason: `Cập nhật thông tin văn bản bởi ${ctx.fullName} (${ctx.employeeCode})`,
        },
      });

      return result;
    });

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản.");

    // Kiểm tra quyền xóa:
    // - ADMIN: xóa mọi văn bản
    // - Người tạo (creatorId): có thể xóa văn bản do mình tạo nếu chưa ban hành/khóa
    // - Nhân sự (CLERK, LEADER, DEPT_HEAD, SPECIALIST): có thể xóa nếu chưa khóa hoặc chưa ban hành
    const isAdmin = ctx.roleCodes.includes("ADMIN");
    const isCreator = doc.creatorId === ctx.userId;
    const isStaff = ctx.roleCodes.some((r) =>
      ["CLERK", "LEADER", "DEPT_HEAD", "SPECIALIST"].includes(r),
    );

    if (!isAdmin && !isCreator && !isStaff) {
      throw new BusinessError("FORBIDDEN", "Bạn không có quyền xóa văn bản này.");
    }

    // Cascade delete sạch sẽ các bản ghi liên quan trong transaction
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { recordId: id } });
      await tx.notification.deleteMany({ where: { documentId: id } });
      await tx.documentHandler.deleteMany({ where: { documentId: id } });
      await tx.documentApproval.deleteMany({ where: { documentId: id } });
      await tx.documentFile.deleteMany({ where: { documentId: id } });
      await tx.incomingWorkflow.deleteMany({ where: { documentId: id } });
      await tx.document.delete({ where: { id } });
    });

    return successResponse({ id, deleted: true, message: "Đã xóa văn bản thành công." });
  } catch (error) {
    return errorResponse(error);
  }
}

