// src/app/api/admin/users/route.ts
// API quản lý danh sách và tạo người dùng mới (Chỉ dành cho ADMIN)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
} from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { hashPassword } from "@/lib/auth/password";
import { createUserSchema } from "@/modules/auth/schema";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.ADMIN_USER_MANAGE);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(
      1,
      parseInt(searchParams.get("pageSize") || "20", 10),
    );
    const search = searchParams.get("search")?.trim() || "";
    const role = searchParams.get("role")?.trim() || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { employeeCode: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role) {
      where.positions = {
        some: {
          endedAt: null,
          roles: { some: { role: { code: role } } },
        },
      };
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          email: true,
          phone: true,
          isActive: true,
          createdAt: true,
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
      }),
    ]);

    return paginatedResponse(users, { page, pageSize, total });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(Permissions.ADMIN_USER_MANAGE);

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      throw new BusinessError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message,
      );
    }

    const { employeeCode, fullName, email, phone, password } = parsed.data;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { employeeCode }],
      },
    });

    if (existing) {
      throw new BusinessError(
        "CONFLICT",
        "Email hoặc Mã nhân viên đã tồn tại trên hệ thống.",
      );
    }

    const passwordToHash =
      password && password.trim().length >= 6 ? password : "User@123";
    const passwordHash = await hashPassword(passwordToHash);

    const newUser = await prisma.user.create({
      data: {
        employeeCode,
        fullName,
        email,
        phone,
        passwordHash,
        isActive: true,
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        isActive: true,
      },
    });

    return successResponse(newUser, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
