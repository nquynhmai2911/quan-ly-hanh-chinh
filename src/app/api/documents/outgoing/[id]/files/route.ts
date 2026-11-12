import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { defaultStorageProvider } from "@/lib/storage";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requirePermission(Permissions.OUTGOING_CREATE);
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new BusinessError("VALIDATION_ERROR", "Vui lòng chọn tệp.");
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM documents WHERE id = ${id} FOR UPDATE`;
      const doc = await tx.document.findUnique({
        where: { id, direction: "OUTGOING" },
      });
      if (
        !doc ||
        (!ctx.roleCodes.includes("ADMIN") && doc.creatorId !== ctx.userId)
      )
        throw new BusinessError("NOT_FOUND");
      if (doc.isLocked || !["DRAFT", "RETURNED"].includes(doc.status))
        throw new BusinessError(
          "CONFLICT",
          "Chỉ được bổ sung tệp khi đang soạn thảo hoặc được trả lại.",
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
          reason: `Bổ sung tệp dự thảo: ${file.name}`,
        },
      });
      return attachment;
    });
    return successResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
