// src/app/api/admin/roles/route.ts
// API quản lý ma trận phân quyền: danh sách vai trò, danh sách quyền và gán quyền

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { invalidateAuthContext } from "@/lib/auth/context";

export async function GET() {
  try {
    await requirePermission(Permissions.ADMIN_ROLE_MANAGE);

    const [roles, permissions] = await Promise.all([
      prisma.role.findMany({
        orderBy: { code: "asc" },
        include: {
          permissions: {
            select: { permissionId: true },
          },
          _count: { select: { userPositions: true } },
        },
      }),
      prisma.permission.findMany({
        orderBy: [{ module: "asc" }, { code: "asc" }],
      }),
    ]);

    return successResponse({ roles, permissions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(Permissions.ADMIN_ROLE_MANAGE);

    const body = await request.json();
    const { roleId, permissionIds } = body as { roleId: string; permissionIds: string[] };

    if (!roleId || !Array.isArray(permissionIds)) {
      throw new BusinessError("VALIDATION_ERROR", "Dữ liệu cập nhật phân quyền không hợp lệ.");
    }

    // Cập nhật ma trận quyền trong transaction
    await prisma.$transaction(async (tx) => {
      // 1. Xóa các quyền cũ của role
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // 2. Gán các quyền mới
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((pId) => ({
            roleId,
            permissionId: pId,
          })),
        });
      }
    });

    // Xóa toàn bộ auth cache để phân quyền mới có hiệu lực ngay
    invalidateAuthContext();

    return successResponse({ message: "Cập nhật ma trận phân quyền thành công." });
  } catch (error) {
    return errorResponse(error);
  }
}
