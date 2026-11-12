// src/app/api/admin/document-types/route.ts
// API quản trị danh mục Loại hồ sơ / Loại văn bản

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { z } from "zod";

const createDocTypeSchema = z.object({
  name: z.string().trim().min(1, "Tên loại hồ sơ/văn bản không được để trống").max(150),
  code: z
    .string()
    .trim()
    .min(1, "Ký hiệu/Mã không được để trống")
    .max(30)
    .regex(/^[A-Za-z0-9Đđ_-]+$/, "Ký hiệu chỉ chứa chữ cái, số, gạch nối"),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    await requirePermission(Permissions.CATALOG_VIEW);

    const docTypes = await prisma.documentType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            documents: true,
            documentBooks: true,
          },
        },
      },
    });

    return successResponse(docTypes);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(Permissions.CATALOG_MANAGE);

    const body = await request.json();
    const parsed = createDocTypeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BusinessError("VALIDATION_ERROR", parsed.error.issues[0]?.message);
    }

    const { name, code, description, sortOrder, isActive } = parsed.data;
    const upperCode = code.toUpperCase();

    // Kiểm tra trùng lặp
    const existing = await prisma.documentType.findFirst({
      where: {
        OR: [{ code: upperCode }, { name: name.trim() }],
      },
    });

    if (existing) {
      if (existing.code.toUpperCase() === upperCode) {
        throw new BusinessError("CONFLICT", `Mã ký hiệu “${upperCode}” đã tồn tại trên hệ thống.`);
      }
      throw new BusinessError("CONFLICT", `Tên loại hồ sơ “${name}” đã tồn tại trên hệ thống.`);
    }

    const created = await prisma.documentType.create({
      data: {
        name: name.trim(),
        code: upperCode,
        description: description?.trim() || null,
        sortOrder,
        isActive,
      },
    });

    return successResponse(created, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

