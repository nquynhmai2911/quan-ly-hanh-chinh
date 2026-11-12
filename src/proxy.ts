// src/proxy.ts
// Proxy (thay cho middleware.ts từ Next.js 16) kiểm tra xác thực và chặn truy cập sớm

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "eoffice_session";

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Chưa cấu hình khóa phiên đăng nhập.");
  return new TextEncoder().encode(secret);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bỏ qua tài nguyên tĩnh và Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let isAuthenticated = false;

  if (token) {
    try {
      await jwtVerify(token, getSecretKey());
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  // 1. Trang Login
  if (pathname === "/login") {
    if (request.nextUrl.searchParams.has("reauth")) {
      const response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/documents/incoming", request.url));
    }
    return NextResponse.next();
  }

  // 2. Các API Authentication công khai
  if (
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout")
  ) {
    return NextResponse.next();
  }

  // 3. Nếu là API nội bộ khác mà chưa đăng nhập -> trả về 401 JSON
  if (pathname.startsWith("/api/")) {
    if (!isAuthenticated) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.",
          },
        },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // 4. Nếu là Web page mà chưa đăng nhập -> chuyển hướng về Login kèm callbackUrl
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
