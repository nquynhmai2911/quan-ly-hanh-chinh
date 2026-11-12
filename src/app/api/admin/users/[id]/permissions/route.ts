// src/app/api/admin/users/[id]/permissions/route.ts
// API quản lý phân quyền riêng trực tiếp cho từng người dùng (User-level Permissions)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { invalidateAuthContext } from "@/lib/auth/context";
import { DataScope } from "@prisma/client";

// In-memory cache cho danh sách quyền tĩnh của hệ thống
let cachedAllPermissions: Array<{
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
}> | null = null;

async function getAllPermissionsCached() {
  if (!cachedAllPermissions || cachedAllPermissions.length === 0) {
    cachedAllPermissions = await prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { code: "asc" }],
    });
  }
  return cachedAllPermissions;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(Permissions.ADMIN_ROLE_MANAGE);
    const { id: userId } = await params;

    const [user, allPermissions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          email: true,
          positions: {
            where: { endedAt: null },
            select: {
              id: true,
              isPrimary: true,
              unit: { select: { id: true, name: true, code: true } },
              position: { select: { id: true, name: true } },
              roles: {
                select: {
                  role: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                      permissions: {
                        select: {
                          permissionId: true,
                        },
                      },
                    },
                  },
                  dataScope: true,
                },
              },
            },
          },
          userPermissions: {
            select: {
              id: true,
              permissionId: true,
              dataScope: true,
              permission: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  module: true,
                },
              },
            },
          },
        },
      }),
      getAllPermissionsCached(),
    ]);

    if (!user) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy người dùng.");
    }

    // Gom danh sách vai trò
    const roles: Array<{ id: string; name: string; code: string; dataScope: string }> = [];
    const inheritedPermIdSet = new Set<string>();

    for (const pos of user.positions) {
      for (const r of pos.roles) {
        roles.push({
          id: r.role.id,
          name: r.role.name,
          code: r.role.code,
          dataScope: r.dataScope,
        });
        for (const p of r.role.permissions) {
          inheritedPermIdSet.add(p.permissionId);
        }
      }
    }

    return successResponse({
      user: {
        id: user.id,
        employeeCode: user.employeeCode,
        fullName: user.fullName,
        email: user.email,
      },
      roles,
      inheritedPermissionIds: Array.from(inheritedPermIdSet),
      directPermissions: user.userPermissions.map((up) => ({
        id: up.id,
        permissionId: up.permissionId,
        dataScope: up.dataScope,
        code: up.permission.code,
        name: up.permission.name,
        module: up.permission.module,
      })),
      allPermissions,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(Permissions.ADMIN_ROLE_MANAGE);
    const { id: userId } = await params;

    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!userExists) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy người dùng.");
    }

    const body = await request.json();
    let recordsToCreate: Array<{ permissionId: string; dataScope?: DataScope }> = [];

    if (Array.isArray(body.permissions)) {
      recordsToCreate = body.permissions.map((p: { permissionId: string; dataScope?: string }) => ({
        permissionId: p.permissionId,
        dataScope: (p.dataScope || "OWN") as DataScope,
      }));
    } else if (Array.isArray(body.permissionIds)) {
      const defaultScope = (body.dataScope || "OWN") as DataScope;
      recordsToCreate = body.permissionIds.map((pId: string) => ({
        permissionId: pId,
        dataScope: defaultScope,
      }));
    } else {
      throw new BusinessError("VALIDATION_ERROR", "Dữ liệu phân quyền không hợp lệ.");
    }

    // Cập nhật phân quyền riêng của user trong Transaction
    await prisma.$transaction(async (tx) => {
      // 1. Xóa toàn bộ quyền riêng cũ của user
      await tx.userPermission.deleteMany({
        where: { userId },
      });

      // 2. Tạo các quyền riêng mới
      if (recordsToCreate.length > 0) {
        await tx.userPermission.createMany({
          data: recordsToCreate.map((item) => ({
            userId,
            permissionId: item.permissionId,
            dataScope: item.dataScope || "OWN",
          })),
        });
      }
    });

    // Invalidate Auth cache của user ngay lập tức
    invalidateAuthContext(userId);

    return successResponse({
      message: "Cập nhật phân quyền cho tài khoản thành công! Quyền có hiệu lực ngay.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}

