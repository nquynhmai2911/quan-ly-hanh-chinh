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
      throw new BusinessError("FORBIDDEN", "Bạn không thể tự xóa tài khoản của chính mình.");
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeCode: true,
        email: true,
        fullName: true,
      },
    });

    if (!user) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy người dùng.");
    }

    if (user.employeeCode === "ADMIN001" || user.email === "admin@eoffice.local") {
      throw new BusinessError("FORBIDDEN", "Không thể xóa tài khoản Quản trị viên hệ thống gốc.");
    }

    // Tìm tài khoản Admin hệ thống để tiếp nhận hồ sơ văn bản nếu có
    const adminUser = await prisma.user.findFirst({
      where: { employeeCode: "ADMIN001" },
    });
    const fallbackAdminId = adminUser ? adminUser.id : ctx.userId;

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Chuyển giao các văn bản đã tạo sang Admin để không vi phạm khóa ngoại
        await tx.document.updateMany({
          where: { creatorId: id },
          data: { creatorId: fallbackAdminId },
        });

        // 2. Cập nhật các luồng quy trình văn bản đến
        await tx.incomingWorkflow.updateMany({
          where: { registrarId: id },
          data: { registrarId: null },
        });
        await tx.incomingWorkflow.updateMany({
          where: { headId: id },
          data: { headId: null },
        });
        await tx.incomingWorkflow.updateMany({
          where: { leaderId: id },
          data: { leaderId: null },
        });

        // 3. Dọn dẹp phân công xử lý, phê duyệt, ký số của người dùng
        await tx.documentHandler.deleteMany({
          where: { OR: [{ assigneeId: id }, { assignerId: id }] },
        });
        await tx.documentApproval.deleteMany({
          where: { approverId: id },
        });
        await tx.documentSignature.deleteMany({
          where: { signerId: id },
        });

        // 4. Chuyển giao hồ sơ lưu trữ và dọn dẹp audit log
        await tx.archive.updateMany({
          where: { creatorId: id },
          data: { creatorId: fallbackAdminId },
        });
        await tx.auditLog.deleteMany({
          where: { actorId: id },
        });

        // 5. Xóa phân quyền trực tiếp và vị trí chức vụ
        await tx.userPermission.deleteMany({
          where: { userId: id },
        });

        const userPositions = await tx.userPosition.findMany({
          where: { userId: id },
          select: { id: true },
        });
        if (userPositions.length > 0) {
          const upIds = userPositions.map((p) => p.id);
          await tx.userPositionRole.deleteMany({
            where: { userPositionId: { in: upIds } },
          });
          await tx.userPosition.deleteMany({
            where: { userId: id },
          });
        }

        // 6. Xóa vĩnh viễn tài khoản người dùng
        await tx.user.delete({
          where: { id },
        });
      });

      invalidateAuthContext(id);

      return successResponse({
        message: `Đã xóa vĩnh viễn tài khoản ${user.fullName} (${user.employeeCode}) thành công.`,
        deleted: true,
      });
    } catch (txError) {
      console.warn("Cascade delete error, falling back to soft deactivation:", txError);
      // Fallback an toàn: nếu có bất kỳ ràng buộc CSDL nào khác, vô hiệu hóa tài khoản an toàn
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      invalidateAuthContext(id);
      return successResponse({
        message: `Đã khóa tài khoản ${user.fullName} do có ràng buộc nghiệp vụ.`,
        deactivated: true,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
