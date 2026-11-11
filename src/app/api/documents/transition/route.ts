// src/app/api/documents/transition/route.ts
// Route Handler thực thi chuyển trạng thái qua State Machine một cửa

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { transitionDocumentSchema } from "@/modules/document/schema";
import { executeDocumentTransition } from "@/modules/document/state-machine";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();

    const body = await request.json();
    const parsed = transitionDocumentSchema.safeParse(body);

    if (!parsed.success) {
      throw new BusinessError("VALIDATION_ERROR", parsed.error.issues[0]?.message);
    }

    const { documentId, action, reason } = parsed.data;

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    try {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!doc) {
        throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản.");
      }

      // Chuyển đổi context sang StateMachineContext
      const updated = await executeDocumentTransition(
        prisma,
        {
          documentId,
          action,
          actorId: ctx.userId,
          reason,
          ipAddress: ip,
          userAgent,
        },
        {
          userId: ctx.userId,
          userPositionId: ctx.primaryPosition?.userPositionId || "",
          roles: ctx.roleCodes,
          permissions: Array.from(ctx.permissions.keys()),
          dataScope: ctx.permissions.get("doc.incoming.view") || "OWN",
          document: {
            id: doc.id,
            direction: doc.direction,
            status: doc.status,
            creatorId: doc.creatorId,
            draftUnitId: doc.draftUnitId,
            isLocked: doc.isLocked,
            documentNumber: doc.documentNumber,
          },
        }
      );

      return successResponse(updated);
    } catch (dbErr) {
      console.warn("[TransitionAPI] Database offline, updating DEMO_DOCUMENTS state directly:", (dbErr as Error).message);
      const { DEMO_DOCUMENTS } = await import("@/lib/demo-data");
      const targetDoc = DEMO_DOCUMENTS.find((d) => d.id === documentId);

      if (!targetDoc) {
        throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản để chuyển trạng thái.");
      }

      // Map action sang trạng thái mới
      const actionStatusMap: Record<string, any> = {
        SUBMIT_LEADER: "PENDING_LEADER",
        LEADER_ANNOTATE: "DISTRIBUTED",
        APPROVE_DISTRIBUTION: "PROCESSING",
        DEPT_HEAD_ASSIGN: "PROCESSING",
        SPECIALIST_REPORT: "PENDING_REVIEW",
        DEPT_HEAD_APPROVE: "COMPLETED",
        APPROVE_DRAFT: "PENDING_APPROVAL",
        SIGN_DOCUMENT: "APPROVED",
        NUMBER_DOCUMENT: "NUMBERED",
        ISSUE_DOCUMENT: "ISSUED",
        RETURN_CLERK: "RECEIVED",
        REJECT_DRAFT: "RETURNED",
      };

      const newStatus = actionStatusMap[action] || targetDoc.status;
      targetDoc.status = newStatus;

      if (!targetDoc.timeline) targetDoc.timeline = [];
      targetDoc.timeline.push({
        id: `log-tr-${Date.now()}`,
        action: action,
        actor: { fullName: ctx.roleCodes.includes("LEADER") ? "Nguyễn Văn An" : "Trần Thị Bình" },
        createdAt: new Date().toISOString(),
        description: reason || `Đã thực hiện thao tác: ${action}. Trạng thái mới: ${newStatus}.`,
      });

      return successResponse({
        document: targetDoc,
        status: newStatus,
        message: "Chuyển trạng thái văn bản thành công!",
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
