// src/app/api/admin/positions/[id]/route.ts
// API cập nhật và xóa chức danh cán bộ

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(Permissions.ADMIN_USER_MANAGE);
    const { id } = await params;

    const body = await request.json();
    const { name, level, isActive } = body;

    const existing = await prisma.position.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy chức danh.");
    }

    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.position.findUnique({
        where: { name: name.trim() },
      });
      if (duplicate && duplicate.id !== id) {
        throw new BusinessError("CONFLICT", `Chức danh '${name}' đã tồn tại.`);
      }
    }

    const updated = await prisma.position.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(typeof level === "number" ? { level } : {}),
        ...(typeof isActive === "boolean" ? { isActive } : {}),
      },
    });

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(Permissions.ADMIN_USER_MANAGE);
    const { id } = await params;

    const existing = await prisma.position.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userPositions: { where: { endedAt: null } } },
        },
      },
    });

    if (!existing) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy chức danh.");
    }

    if (existing._count.userPositions > 0) {
      // Nếu còn cán bộ giữ chức danh này, chỉ chuyển trạng thái ngừng hoạt động
      const updated = await prisma.position.update({
        where: { id },
        data: { isActive: false },
      });
      return successResponse({
        message: `Chức danh đang có ${existing._count.userPositions} cán bộ đảm nhiệm, đã chuyển sang trạng thái tạm dừng.`,
        data: updated,
      });
    }

    await prisma.position.delete({
      where: { id },
    });

    return successResponse({ message: "Xóa chức danh thành công." });
  } catch (error) {
    return errorResponse(error);
  }
}

