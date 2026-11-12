import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import {
  lockedDocument,
  mayAttach,
} from "@/modules/document/incoming/workflow";
import { defaultStorageProvider } from "@/lib/storage";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new BusinessError(
        "VALIDATION_ERROR",
        "Vui lòng chọn tệp đính kèm.",
      );
    const result = await prisma.$transaction(async (tx) => {
      const doc = await lockedDocument(tx, ctx, id);
      if (!mayAttach(ctx, doc))
        throw new BusinessError(
          "FORBIDDEN",
          "Chỉ được bổ sung tệp trước khi trình lãnh đạo, hoặc khi hồ sơ được trả lại văn thư.",
        );
      const stored = await defaultStorageProvider.saveFile(
        Buffer.from(await file.arrayBuffer()),
        file.name,
        file.type,
      );
      const attachment = await tx.documentFile.create({
        data: { ...stored, documentId: id, uploaderId: ctx.userId },
      });
      await tx.auditLog.create({
        data: {
          actorId: ctx.userId,
          action: "DOC_ATTACH_FILE",
          tableName: "documents",
          recordId: id,
          reason: `Đính kèm tệp: ${stored.fileName}`,
        },
      });
      return attachment;
    });
    return successResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
