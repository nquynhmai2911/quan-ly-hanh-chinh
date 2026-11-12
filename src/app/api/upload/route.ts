// src/app/api/upload/route.ts
// Route Handler tiếp nhận và lưu file tải lên

import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/guard";
import { defaultStorageProvider } from "@/lib/storage";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!(file instanceof File)) {
      throw new BusinessError(
        "VALIDATION_ERROR",
        "Không tìm thấy file tải lên.",
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await defaultStorageProvider.saveFile(
      buffer,
      file.name,
      file.type,
    );

    const upload = await prisma.pendingUpload.create({
      data: {
        ...stored,
        uploaderId: ctx.userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return successResponse({ ...stored, uploadId: upload.id }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
