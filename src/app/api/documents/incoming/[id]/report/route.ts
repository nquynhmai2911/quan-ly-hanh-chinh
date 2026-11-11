// src/app/api/documents/incoming/[id]/report/route.ts
// API Chuyên viên nộp báo cáo kết quả thụ lý văn bản đến

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { reportResultSchema } from "@/modules/document/schema";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requirePermission(Permissions.INCOMING_PROCESS);
    const { id: docId } = await params;

    const body = await request.json();
    const parsed = reportResultSchema.safeParse({ ...body, documentId: docId });

    if (!parsed.success) {
      throw new BusinessError("VALIDATION_ERROR", parsed.error.issues[0]?.message);
    }

    const { reportContent } = parsed.data;

    // Tìm handler của người dùng này với văn bản
    try {
      const handler = await prisma.documentHandler.findFirst({
        where: {
          documentId: docId,
          assigneeId: ctx.userId,
        },
        include: {
          document: true,
          assigner: true,
        },
      });

      if (!handler) {
        throw new BusinessError("FORBIDDEN", "Bạn không được phân công xử lý văn bản này.");
      }

      const updated = await prisma.$transaction(async (tx) => {
        const h = await tx.documentHandler.update({
          where: { id: handler.id },
          data: {
            status: "REPORTED",
            reportContent,
            completedAt: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: ctx.userId,
            action: "DOC_HANDLER_REPORT",
            tableName: "document_handlers",
            recordId: handler.id,
            newState: { status: "REPORTED", reportContent },
            reason: `Chuyên viên nộp báo cáo kết quả (${handler.role})`,
          },
        });

        // Báo cho người giao việc
        await tx.notification.create({
          data: {
            recipientId: handler.assignerId,
            actorId: ctx.userId,
            type: "DOC_COMPLETED",
            title: "Đã nộp báo cáo xử lý văn bản",
            content: `${ctx.fullName} đã nộp báo cáo kết quả cho văn bản: "${handler.document.title}".`,
            documentId: docId,
          },
        });

        return h;
      });

      return successResponse(updated);
    } catch (dbErr) {
      console.warn("[ReportAPI] Database offline, updating DEMO_DOCUMENTS directly:", (dbErr as Error).message);
      const { DEMO_DOCUMENTS } = await import("@/lib/demo-data");
      const targetDoc = DEMO_DOCUMENTS.find((d) => d.id === docId);

      if (!targetDoc) {
        throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản để nộp báo cáo.");
      }

      if (targetDoc.handlers && targetDoc.handlers.length > 0) {
        (targetDoc.handlers[0] as any).status = "REPORTED";
        (targetDoc.handlers[0] as any).reportContent = reportContent;
      }
      targetDoc.status = "PENDING_REVIEW";

      if (!targetDoc.timeline) targetDoc.timeline = [];
      targetDoc.timeline.push({
        id: `log-rep-${Date.now()}`,
        action: "BÁO CÁO KẾT QUẢ",
        actor: { fullName: "Phạm Minh Đức" },
        createdAt: new Date().toISOString(),
        description: `Chuyên viên đã hoàn thành và nộp báo cáo: "${reportContent}". Chờ Trưởng phòng phê duyệt nghiệm thu.`,
      });

      return successResponse({
        status: "REPORTED",
        reportContent,
        message: "Nộp báo cáo kết quả thành công!",
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
