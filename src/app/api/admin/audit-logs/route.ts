// src/app/api/admin/audit-logs/route.ts
// API Tra cứu Nhật ký hoạt động hệ thống (Chỉ dành cho ADMIN, append-only)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
} from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.ADMIN_SYSTEM);
    const { searchParams } = new URL(request.url);

    const action = searchParams.get("action") || "";
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)),
    );

    let logs: Awaited<ReturnType<typeof prisma.auditLog.findMany>> = [];
    let total = 0;

    const where: Prisma.AuditLogWhereInput = {};
    if (action) where.action = action;
    if (search) {
      where.OR = [
        { reason: { contains: search, mode: "insensitive" } },
        { recordId: { contains: search, mode: "insensitive" } },
      ];
    }

    const [count, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, fullName: true, employeeCode: true } },
        },
      }),
    ]);

    total = count;
    logs = items;

    return paginatedResponse(logs, { page, pageSize, total });
  } catch (error) {
    return errorResponse(error);
  }
}
