// src/app/api/auth/change-password/route.ts
// Route Handler đổi mật khẩu cho người dùng hiện tại

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { changePasswordSchema } from "@/modules/auth/schema";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new BusinessError("UNAUTHORIZED", "Chưa đăng nhập.");
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      throw new BusinessError("VALIDATION_ERROR", parsed.error.issues[0]?.message);
    }

    const { currentPassword, newPassword } = parsed.data;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy tài khoản.");
    }

    const isMatch = await verifyPassword(currentPassword, dbUser.passwordHash);
    if (!isMatch) {
      throw new BusinessError("VALIDATION_ERROR", "Mật khẩu hiện tại không đúng.");
    }

    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return successResponse({ message: "Đổi mật khẩu thành công." });
  } catch (error) {
    return errorResponse(error);
  }
}
