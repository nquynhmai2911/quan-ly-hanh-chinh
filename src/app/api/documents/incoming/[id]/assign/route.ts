import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { assignHandlerSchema } from "@/modules/document/schema";
import {
  audit,
  incomingActions,
  lockedDocument,
  notify,
  requireRecipient,
} from "@/modules/document/incoming/workflow";
import { roleLabels } from "@/lib/display-labels";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const parsed = assignHandlerSchema.safeParse({
      ...(await request.json()),
      documentId: id,
    });
    if (!parsed.success)
      throw new BusinessError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message,
      );
    const handlers = parsed.data.handlers;
    if (new Set(handlers.map((h) => h.assigneeId)).size !== handlers.length)
      throw new BusinessError(
        "VALIDATION_ERROR",
        "Mỗi cán bộ chỉ được chọn một lần.",
      );
    const result = await prisma.$transaction(async (tx) => {
      const doc = await lockedDocument(tx, ctx, id);
      if (
        !incomingActions(ctx, doc).some(
          (a) => a.action === "DEPT_HEAD_ASSIGN",
        ) ||
        !doc.workflow?.unitId
      )
        throw new BusinessError(
          "FORBIDDEN",
          "Chỉ trưởng phòng được giao mới được phân công sau khi lãnh đạo bút phê.",
        );
      if (doc.handlers.length)
        throw new BusinessError("CONFLICT", "Văn bản đã được phân công.");
      const created = [];
      for (const h of handlers) {
        if (h.unitId !== doc.workflow.unitId)
          throw new BusinessError(
            "VALIDATION_ERROR",
            "Cán bộ phải thuộc phòng ban được lãnh đạo giao xử lý.",
          );
        await requireRecipient(tx, h.assigneeId, "SPECIALIST", h.unitId);
        const record = await tx.documentHandler.create({
          data: {
            documentId: id,
            assignerId: ctx.userId,
            assigneeId: h.assigneeId,
            unitId: h.unitId,
            role: h.role,
            deadline: h.deadline || doc.processingDeadline,
            instruction: h.instruction || doc.workflow.instruction,
          },
        });
        created.push(record);
        await notify(
          tx,
          ctx,
          id,
          [h.assigneeId],
          "Được giao xử lý văn bản",
          `Vai trò ${roleLabels[h.role]}: ${doc.title}. ${record.instruction || ""}`,
        );
      }
      await tx.document.update({
        where: { id },
        data: { status: "PROCESSING" },
      });
      await audit(
        tx,
        ctx,
        doc,
        "ASSIGN_HANDLERS",
        "PROCESSING",
        `Phân công ${handlers.length} cán bộ; một người chủ trì.`,
      );
      return created;
    });
    return successResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
