import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { incomingScope, isCitizen } from "@/modules/document/incoming/access";
import {
  incomingActions,
  mayAttach,
  mayReport,
  workflowInclude,
} from "@/modules/document/incoming/workflow";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const doc = await prisma.document.findFirst({
      where: { AND: [{ id }, incomingScope(ctx)] },
      include: {
        ...workflowInclude,
        documentBook: { select: { id: true, name: true, code: true } },
        documentType: { select: { id: true, name: true, code: true } },
        field: true,
        senderOrg: true,
        draftUnit: true,
        creator: { select: { id: true, fullName: true, employeeCode: true } },
        handlers: {
          include: {
            assignee: {
              select: { id: true, fullName: true, employeeCode: true },
            },
            unit: { select: { id: true, name: true } },
          },
          orderBy: { assignedAt: "asc" },
        },
        files: {
          where: { isCurrent: true },
          include: { uploader: { select: { fullName: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!doc)
      throw new BusinessError(
        "NOT_FOUND",
        "Không tìm thấy văn bản hoặc bạn không có quyền xem.",
      );
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { tableName: "documents", recordId: id },
          {
            tableName: "document_handlers",
            recordId: { in: doc.handlers.map((h) => h.id) },
          },
        ],
      },
      include: { actor: { select: { fullName: true, employeeCode: true } } },
      orderBy: { createdAt: "asc" },
    });
    const allowedActions = incomingActions(ctx, doc);
    return successResponse({
      document: doc,
      auditLogs,
      allowedActions,
      canAssign: allowedActions.some((a) => a.action === "DEPT_HEAD_ASSIGN"),
      canAttach: mayAttach(ctx, doc),
      canReport: mayReport(ctx, doc),
      isCitizen: isCitizen(ctx),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
