// src/app/api/auth/logout/route.ts
// Route Handler xử lý đăng xuất hệ thống

import { clearSessionCookie } from "@/lib/auth/session";
import { successResponse } from "@/lib/api-response";

export async function POST() {
  await clearSessionCookie();
  return successResponse({ message: "Đăng xuất thành công." });
}
