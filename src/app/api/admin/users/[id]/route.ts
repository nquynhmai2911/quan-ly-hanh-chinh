// src/app/api/admin/users/[id]/route.ts
// API xem, cập nhật và khóa/xóa tài khoản người dùng

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { hashPassword } from "@/lib/auth/password";
import { invalidateAuthContext } from "@/lib/auth/context";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(Permissions.ADMIN_USER_MANAGE);
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        positions: {
          where: { endedAt: null },
          select: {
            id: true,
            isPrimary: true,
            unit: { select: { id: true, name: true, code: true } },
            position: { select: { id: true, name: true } },
            roles: {
              select: {
                role: { select: { id: true, name: true, code: true } },
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
    });

    if (!user) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy người dùng.");
    }

    return successResponse(user);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(Permissions.ADMIN_USER_MANAGE);
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy người dùng.");
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.fullName !== undefined) updateData.fullName = body.fullName.trim();
    if (body.email !== undefined) updateData.email = body.email.trim();
    if (body.phone !== undefined) updateData.phone = body.phone ? body.phone.trim() : null;
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

    if (body.password && body.password.trim().length >= 6) {
      updateData.passwordHash = await hashPassword(body.password.trim());
    }

    // Kiểm tra trùng email nếu thay đổi email
    if (updateData.email && updateData.email !== user.email) {
      const emailExists = await prisma.user.findFirst({
        where: { email: updateData.email as string, id: { not: id } },
      });
      if (emailExists) {
        throw new BusinessError("CONFLICT", "Địa chỉ email này đã được sử dụng.");
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        phone: true,
        isActive: true,
      },
    });

    invalidateAuthContext(id);

    return successResponse(updatedUser);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(Permissions.ADMIN_USER_MANAGE);
    const ctx = await requireAuth();
    const { id } = await params;

    if (ctx.userId === id) {
      throw new BusinessError("FORBIDDEN", "Bạn không thể khóa hoặc xóa tài khoản của chính mình.");
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            createdDocuments: true,
            assignedHandlers: true,
            documentApprovals: true,
          },
        },
      },
    });

    if (!user) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy người dùng.");
    }

    // Nếu người dùng đã có phát sinh dữ liệu nghiệp vụ (văn bản, xử lý, duyệt), ta chỉ khóa tài khoản (Soft Delete / Deactivate)
    const hasData =
      user._count.createdDocuments > 0 ||
      user._count.assignedHandlers > 0 ||
      user._count.documentApprovals > 0;

    if (hasData) {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      invalidateAuthContext(id);
      return successResponse({
        message: "Tài khoản đã được vô hiệu hóa/khóa an toàn do có liên kết hồ sơ văn bản.",
        deactivated: true,
      });
    }

    // Nếu là tài khoản mới chưa phát sinh dữ liệu, xóa hẳn
    await prisma.user.delete({
      where: { id },
    });
    invalidateAuthContext(id);

    return successResponse({
      message: "Đã xóa tài khoản người dùng thành công.",
      deleted: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

