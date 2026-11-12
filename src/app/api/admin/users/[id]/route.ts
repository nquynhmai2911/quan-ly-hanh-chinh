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

    // Kiểm tra xem người dùng có phát sinh dữ liệu nghiệp vụ quan trọng (văn bản, xử lý, duyệt, ký số, hồ sơ lưu trữ) hay không
    const [
      createdDocs,
      assignedHandlers,
      assignedByHandlers,
      documentApprovals,
      signatures,
      createdArchives,
      incomingLed,
      incomingManaged,
      incomingRegistered,
      auditLogs,
    ] = await Promise.all([
      prisma.document.count({ where: { creatorId: id } }),
      prisma.documentHandler.count({ where: { assigneeId: id } }),
      prisma.documentHandler.count({ where: { assignerId: id } }),
      prisma.documentApproval.count({ where: { approverId: id } }),
      prisma.documentSignature.count({ where: { signerId: id } }),
      prisma.archive.count({ where: { creatorId: id } }),
      prisma.incomingWorkflow.count({ where: { leaderId: id } }),
      prisma.incomingWorkflow.count({ where: { headId: id } }),
      prisma.incomingWorkflow.count({ where: { registrarId: id } }),
      prisma.auditLog.count({ where: { actorId: id } }),
    ]);

    const hasData =
      createdDocs > 0 ||
      assignedHandlers > 0 ||
      assignedByHandlers > 0 ||
      documentApprovals > 0 ||
      signatures > 0 ||
      createdArchives > 0 ||
      incomingLed > 0 ||
      incomingManaged > 0 ||
      incomingRegistered > 0 ||
      auditLogs > 0;

    if (hasData) {
      // Vô hiệu hóa an toàn (Soft delete) để bảo toàn tính toàn vẹn dữ liệu
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      invalidateAuthContext(id);
      return successResponse({
        message: "Tài khoản đã được vô hiệu hóa / khóa an toàn do có liên kết hồ sơ văn bản lịch sử.",
        deactivated: true,
      });
    }

    // Nếu tài khoản chưa phát sinh dữ liệu văn bản nghiệp vụ, xóa sạch toàn bộ các bản ghi phụ thuộc trong transaction
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Xóa phân quyền trực tiếp
        await tx.userPermission.deleteMany({
          where: { userId: id },
        });

        // 2. Xóa các vai trò gắn với vị trí chức danh của người dùng
        await tx.userPositionRole.deleteMany({
          where: { userPosition: { userId: id } },
        });

        // 3. Xóa các vị trí chức danh công tác
        await tx.userPosition.deleteMany({
          where: { userId: id },
        });

        // 4. Xóa thông báo liên quan
        await tx.notification.deleteMany({
          where: { OR: [{ recipientId: id }, { actorId: id }] },
        });

        // 5. Xóa lịch sử đã đọc văn bản
        await tx.documentReader.deleteMany({
          where: { userId: id },
        });

        // 6. Xóa các tệp tải lên tạm
        await tx.pendingUpload.deleteMany({
          where: { uploaderId: id },
        });

        // 7. Xóa tài khoản người dùng
        await tx.user.delete({
          where: { id },
        });
      });

      invalidateAuthContext(id);

      return successResponse({
        message: "Đã xóa hoàn toàn tài khoản người dùng thành công.",
        deleted: true,
      });
    } catch (deleteError) {
      console.warn("Không thể xóa cứng tài khoản do ràng buộc dữ liệu, tự động chuyển sang khóa tài khoản an toàn:", deleteError);
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      invalidateAuthContext(id);
      return successResponse({
        message: "Tài khoản đã được vô hiệu hóa / khóa an toàn do có ràng buộc dữ liệu hệ thống.",
        deactivated: true,
      });
    }
  } catch (error) {
    return errorResponse(error);
  }
}

