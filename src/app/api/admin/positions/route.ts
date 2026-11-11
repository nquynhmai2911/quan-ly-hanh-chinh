// src/app/api/admin/positions/route.ts
// API quản lý danh sách và tạo Chức danh

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";

export async function GET() {
  try {
    await requirePermission(Permissions.ADMIN_USER_MANAGE);

    const positions = await prisma.position.findMany({
      orderBy: { level: "asc" },
      include: {
        _count: { select: { userPositions: { where: { endedAt: null } } } },
      },
    });

    return successResponse(positions);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(Permissions.ADMIN_USER_MANAGE);

    const body = await request.json();
    const { name, level = 0 } = body;

    if (!name || name.trim().length === 0) {
      throw new BusinessError("VALIDATION_ERROR", "Tên chức danh không được để trống.");
    }

    const existing = await prisma.position.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      throw new BusinessError("CONFLICT", `Chức danh '${name}' đã tồn tại.`);
    }

    const pos = await prisma.position.create({
      data: {
        name: name.trim(),
        level: Number(level) || 0,
        isActive: true,
      },
    });

    return successResponse(pos, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
