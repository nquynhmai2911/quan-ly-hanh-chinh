// src/app/api/admin/users/[id]/position/route.ts
// Gán chức vụ, đơn vị và vai trò cho người dùng (kèm Data Scope) - Chống duplicate position

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

    // Dùng transaction để đảm bảo cập nhật an toàn và chống duplicate position
    const userPosition = await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        // Tìm vị trí chính đang hoạt động
        const existingPositions = await tx.userPosition.findMany({
          where: { userId, isPrimary: true, endedAt: null },
          orderBy: { startedAt: "desc" },
        });

        if (existingPositions.length > 0) {
          const primaryPos = existingPositions[0];

          // Dọn dẹp các vị trí trùng lặp nếu có
          if (existingPositions.length > 1) {
            const duplicateIds = existingPositions.slice(1).map((p) => p.id);
            await tx.userPositionRole.deleteMany({
              where: { userPositionId: { in: duplicateIds } },
            });
            await tx.userPosition.deleteMany({
              where: { id: { in: duplicateIds } },
            });
          }

          // Cập nhật vai trò cho vị trí chính
          await tx.userPositionRole.deleteMany({
            where: { userPositionId: primaryPos.id },
          });

          return tx.userPosition.update({
            where: { id: primaryPos.id },
            data: {
              unitId,
              positionId,
              roles: {
                create: {
                  roleId,
                  dataScope: dataScope as DataScope,
                },
              },
            },
            include: {
              roles: { include: { role: true } },
              position: true,
              unit: true,
            },
          });
        }
      }

      // Nếu chưa có vị trí chính, tạo mới
      return tx.userPosition.create({
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
        include: {
          roles: { include: { role: true } },
          position: true,
          unit: true,
        },
      });
    });

    // Invalidate cache ngay lập tức để quyền có hiệu lực tức thì
    invalidateAuthContext(userId);

    return successResponse(userPosition, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
