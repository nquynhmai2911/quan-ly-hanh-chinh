// src/app/api/admin/document-types/[id]/route.ts
// API xem, cập nhật, xóa Loại hồ sơ / Loại văn bản

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { z } from "zod";

const updateDocTypeSchema = z.object({
  name: z.string().trim().min(1, "Tên loại hồ sơ không được để trống").max(150).optional(),
  code: z
    .string()
    .trim()
    .min(1, "Ký hiệu/Mã không được để trống")
    .max(30)
    .regex(/^[A-Za-z0-9Đđ_-]+$/, "Ký hiệu chỉ chứa chữ cái, số, gạch nối")
    .optional(),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(Permissions.CATALOG_VIEW);
    const { id } = await params;

    const docType = await prisma.documentType.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            documents: true,
            documentBooks: true,
          },
        },
      },
    });

    if (!docType) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy loại hồ sơ/văn bản.");
    }

    return successResponse(docType);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(Permissions.CATALOG_MANAGE);
    const { id } = await params;

    const body = await request.json();
    const parsed = updateDocTypeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BusinessError("VALIDATION_ERROR", parsed.error.issues[0]?.message);
    }

    const current = await prisma.documentType.findUnique({
      where: { id },
    });
    if (!current) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy loại hồ sơ/văn bản cần sửa.");
    }

    const updateData: {
      name?: string;
      code?: string;
      description?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    } = {};

    if (parsed.data.name !== undefined) {
      const name = parsed.data.name.trim();
      const duplicate = await prisma.documentType.findFirst({
        where: { name, NOT: { id } },
      });
      if (duplicate) {
        throw new BusinessError("CONFLICT", `Tên loại hồ sơ “${name}” đã được sử dụng.`);
      }
      updateData.name = name;
    }

    if (parsed.data.code !== undefined) {
      const code = parsed.data.code.toUpperCase();
      const duplicate = await prisma.documentType.findFirst({
        where: { code, NOT: { id } },
      });
      if (duplicate) {
        throw new BusinessError("CONFLICT", `Mã ký hiệu “${code}” đã được sử dụng.`);
      }
      updateData.code = code;
    }

    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description?.trim() || null;
    }

    if (parsed.data.sortOrder !== undefined) {
      updateData.sortOrder = parsed.data.sortOrder;
    }

    if (parsed.data.isActive !== undefined) {
      updateData.isActive = parsed.data.isActive;
    }

    const updated = await prisma.documentType.update({
      where: { id },
      data: updateData,
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
    await requirePermission(Permissions.CATALOG_MANAGE);
    const { id } = await params;

    const docType = await prisma.documentType.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            documents: true,
            documentBooks: true,
          },
        },
      },
    });

    if (!docType) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy loại hồ sơ/văn bản cần xóa.");
    }

    if (docType._count.documents > 0) {
      throw new BusinessError(
        "CONFLICT",
        `Không thể xóa loại hồ sơ này vì đã có ${docType._count.documents} văn bản đang sử dụng. Bạn có thể chọn “Tắt hoạt động” thay vì xóa.`,
      );
    }

    if (docType._count.documentBooks > 0) {
      throw new BusinessError(
        "CONFLICT",
        `Không thể xóa vì đang liên kết với ${docType._count.documentBooks} sổ văn bản. Vui lòng gỡ liên kết sổ trước khi xóa.`,
      );
    }

    await prisma.documentType.delete({
      where: { id },
    });

    return successResponse({ deleted: true, id });
  } catch (error) {
    return errorResponse(error);
  }
}

