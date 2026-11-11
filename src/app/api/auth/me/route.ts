// src/app/api/auth/me/route.ts
// Lấy thông tin phiên đăng nhập và quyền hạn hiện tại

import { getCurrentUser } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/context";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new BusinessError("UNAUTHORIZED", "Chưa đăng nhập.");
    }

    const authContext = await getAuthContext(user.id);
    if (!authContext) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy thông tin tài khoản.");
    }

    // Chuyển Map permissions thành Object để serialize JSON
    const permissionsObj: Record<string, string> = {};
    authContext.permissions.forEach((scope, perm) => {
      permissionsObj[perm] = scope;
    });

    return successResponse({
      user: {
        id: authContext.userId,
        employeeCode: authContext.employeeCode,
        fullName: authContext.fullName,
        email: authContext.email,
        avatarUrl: authContext.avatarUrl,
      },
      positions: authContext.positions,
      primaryPosition: authContext.primaryPosition,
      roles: authContext.roleCodes,
      permissions: permissionsObj,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
