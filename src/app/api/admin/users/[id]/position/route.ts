// src/app/api/admin/users/[id]/position/route.ts
// Gán chức vụ, đơn vị và vai trò cho người dùng (kèm Data Scope)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { invalidateAuthContext } from "@/lib/auth/context";
import { DataScope } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(Permissions.ADMIN_ROLE_MANAGE);
    const { id: userId } = await params;

    const body = await request.json();
    const { unitId, positionId, roleId, dataScope = "OWN", isPrimary = true } = body;

    if (!unitId || !positionId || !roleId) {
      throw new BusinessError("VALIDATION_ERROR", "Thiếu đơn vị, chức danh hoặc vai trò.");
    }

    // Tạo hoặc cập nhật UserPosition
    const userPosition = await prisma.userPosition.create({
      data: {
        userId,
        unitId,
        positionId,
        isPrimary,
        startedAt: new Date(),
        roles: {
          create: {
            roleId,
            dataScope: dataScope as DataScope,
          },
        },
      },
    });

    // Invalidate cache ngay lập tức để quyền có hiệu lực tức thì
    invalidateAuthContext(userId);

    return successResponse(userPosition, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
