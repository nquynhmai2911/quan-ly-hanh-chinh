// src/lib/auth/session.ts
// Quản lý JWT Session gọn nhẹ, bảo mật cao bằng thư viện standard `jose`

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SessionUser } from "@/types/auth";

export const SESSION_COOKIE_NAME = "eoffice_session";
const SESSION_EXPIRATION = "7d";

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Chưa cấu hình khóa phiên đăng nhập.");
  return new TextEncoder().encode(secret);
}

/** Ký tạo JWT token từ thông tin người dùng tối giản */
export async function signSession(user: SessionUser): Promise<string> {
  const secret = getSecretKey();
  return new SignJWT({
    id: user.id,
    employeeCode: user.employeeCode,
    fullName: user.fullName,
    email: user.email,
    avatarUrl: user.avatarUrl,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRATION)
    .sign(secret);
}

/** Giải mã và xác thực token JWT */
export async function verifySession(
  token: string,
): Promise<SessionUser | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      employeeCode: payload.employeeCode as string,
      fullName: payload.fullName as string,
      email: payload.email as string,
      avatarUrl: (payload.avatarUrl as string) || null,
    };
  } catch {
    return null;
  }
}

/** Lấy thông tin user hiện tại từ Cookie session (Server Components & Route Handlers) */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) return null;
    return await verifySession(sessionToken);
  } catch {
    return null;
  }
}

/** Lưu cookie session */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 ngày
  });
}

/** Xóa cookie session khi đăng xuất */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
