// src/app/api/admin/units/route.ts
// API quản lý danh sách và tạo Đơn vị / Phòng ban

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { unitSchema } from "@/modules/catalog/schema";

export async function GET() {
  try {
    await requirePermission(Permissions.ADMIN_UNIT_MANAGE);

    const units = await prisma.unit.findMany({
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
      include: {
        parent: { select: { id: true, name: true, code: true } },
        _count: { select: { positions: { where: { endedAt: null } } } },
      },
    });

    return successResponse(units);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(Permissions.ADMIN_UNIT_MANAGE);

    const body = await request.json();
    const parsed = unitSchema.safeParse(body);

    if (!parsed.success) {
      throw new BusinessError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message,
      );
    }

    const { name, code, parentId, sortOrder, isActive } = parsed.data;

    const existing = await prisma.unit.findUnique({
      where: { code },
    });

    if (existing) {
      throw new BusinessError(
        "CONFLICT",
        `Ký hiệu đơn vị '${code}' đã tồn tại.`,
      );
    }

    let level = 0;
    if (parentId) {
      const parent = await prisma.unit.findUnique({ where: { id: parentId } });
      if (parent) {
        level = parent.level + 1;
      }
    }

    const newUnit = await prisma.unit.create({
      data: {
        name,
        code,
        parentId: parentId || null,
        level,
        sortOrder: sortOrder || 0,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return successResponse(newUnit, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
