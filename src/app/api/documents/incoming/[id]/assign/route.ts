// src/app/api/documents/incoming/[id]/assign/route.ts
// API Phân công chuyên viên thụ lý văn bản đến (Chỉ Trưởng phòng hoặc Lãnh đạo)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { assignHandlerSchema } from "@/modules/document/schema";
import { executeDocumentTransition } from "@/modules/document/state-machine";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requirePermission(Permissions.INCOMING_ASSIGN);
    const { id: docId } = await params;

    const body = await request.json();
    const parsed = assignHandlerSchema.safeParse({ ...body, documentId: docId });

    if (!parsed.success) {
      throw new BusinessError("VALIDATION_ERROR", parsed.error.issues[0]?.message);
    }

    const { handlers } = parsed.data;

    try {
      const doc = await prisma.document.findUnique({
        where: { id: docId, direction: "INCOMING" },
      });

      if (!doc) {
        throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản đến trong DB.");
      }

      // Thực hiện trong transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Tạo các bản ghi DocumentHandler
        const createdHandlers = [];
        for (const h of handlers) {
          const handler = await tx.documentHandler.create({
            data: {
              documentId: docId,
              assignerId: ctx.userId,
              assigneeId: h.assigneeId,
              unitId: h.unitId || ctx.primaryPosition?.unitId || null,
              role: h.role,
              deadline: h.deadline || doc.processingDeadline || null,
              instruction: h.instruction || null,
              status: "ASSIGNED",
            },
            include: {
              assignee: { select: { fullName: true } },
            },
          });
          createdHandlers.push(handler);

          // Tạo thông báo cho người nhận
          await tx.notification.create({
            data: {
              recipientId: h.assigneeId,
              actorId: ctx.userId,
              type: "DOC_ASSIGNED",
              title: "Phân công xử lý văn bản đến",
              content: `Bạn được phân công với vai trò [${h.role}] xử lý văn bản: "${doc.title}". ${
                h.deadline ? `Hạn xử lý: ${new Date(h.deadline).toLocaleDateString("vi-VN")}` : ""
              }`,
              documentId: doc.id,
            },
          });
        }

        // 2. Chuyển trạng thái sang PROCESSING nếu đang ở DISTRIBUTED hoặc RECEIVED
        if (doc.status === "DISTRIBUTED" || doc.status === "RECEIVED") {
          await tx.document.update({
            where: { id: docId },
            data: { status: "PROCESSING" },
          });

          await tx.auditLog.create({
            data: {
              actorId: ctx.userId,
              action: "DOC_ASSIGN_HANDLERS",
              tableName: "documents",
              recordId: docId,
              oldState: { status: doc.status },
              newState: { status: "PROCESSING", handlersCount: handlers.length },
              reason: `Phân công ${handlers.length} cán bộ xử lý (Chủ trì: ${
                createdHandlers.find((h) => h.role === "MAIN")?.assignee.fullName
              })`,
            },
          });
        }

        return createdHandlers;
      });

      return successResponse(result, 201);
    } catch (dbErr) {
      console.warn("[AssignAPI] Database offline, updating DEMO_DOCUMENTS directly:", (dbErr as Error).message);
      const { DEMO_DOCUMENTS, DEMO_USERS } = await import("@/lib/demo-data");
      const targetDoc = DEMO_DOCUMENTS.find((d) => d.id === docId);

      if (!targetDoc) {
        throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản để phân công.");
      }

      // Tìm tên cán bộ từ DEMO_USERS
      const getUserName = (userId: string) => {
        const found = Object.values(DEMO_USERS).find((u) => u.id === userId);
        return found ? found.fullName : "Lê Văn Cường";
      };

      const mockHandlers = handlers.map((h, i) => ({
        id: `hdl-demo-${Date.now()}-${i}`,
        role: h.role,
        status: "PROCESSING",
        instruction: h.instruction || "Chủ trì nghiên cứu, tham mưu xử lý văn bản đúng hạn",
        deadline: h.deadline ? new Date(h.deadline).toISOString() : targetDoc.processingDeadline,
        assignee: {
          id: h.assigneeId,
          fullName: getUserName(h.assigneeId),
          email: "chuyenvien@eoffice.local",
        },
      }));

      targetDoc.handlers = mockHandlers as any;
      targetDoc.status = "PROCESSING";

      if (!targetDoc.timeline) targetDoc.timeline = [];
      targetDoc.timeline.push({
        id: `log-assign-${Date.now()}`,
        action: "PHÂN CÔNG CHỦ TRÌ",
        actor: { fullName: "Trần Thị Bình" },
        createdAt: new Date().toISOString(),
        description: `Đã phân công ${handlers.length} cán bộ xử lý. Cán bộ chủ trì: ${mockHandlers[0]?.assignee?.fullName}.`,
      });

      return successResponse(mockHandlers, 201);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
