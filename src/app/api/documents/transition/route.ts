// src/app/api/documents/transition/route.ts
// Route Handler thực thi chuyển trạng thái qua State Machine một cửa

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { transitionDocumentSchema } from "@/modules/document/schema";
import { transitionIncoming } from "@/modules/document/incoming/workflow";
import { executeDocumentTransition } from "@/modules/document/state-machine";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();

    const body = await request.json();
    const parsed = transitionDocumentSchema.safeParse(body);

    if (!parsed.success) {
      throw new BusinessError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message,
      );
    }

    const { documentId, action, reason } = parsed.data;
    if (action === "DEPT_HEAD_ASSIGN") {
      throw new BusinessError(
        "VALIDATION_ERROR",
        "Vui lòng chọn cán bộ trong danh sách phân công xử lý.",
      );
    }

    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản.");
    }

    if (doc.direction === "INCOMING")
      return successResponse(
        await transitionIncoming(ctx, documentId, parsed.data),
      );
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
      },
    );

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
