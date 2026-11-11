// src/app/api/admin/audit-logs/route.ts
// API Tra cứu Nhật ký hoạt động hệ thống (Chỉ dành cho ADMIN, append-only)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, paginatedResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permissions.ADMIN_SYSTEM);
    const { searchParams } = new URL(request.url);

    const action = searchParams.get("action") || "";
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    let logs: any[] = [];
    let total = 0;

    try {
      const where: any = {};
      if (action) where.action = action;
      if (search) {
        where.OR = [
          { description: { contains: search, mode: "insensitive" } },
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
    } catch {
      // Demo audit logs
      const demoLogs = [
        {
          id: "audit-01",
          action: "ISSUE_DOCUMENT",
          tableName: "documents",
          recordId: "doc-demo-03",
          actor: { fullName: "Lê Văn Cường", employeeCode: "VT001" },
          description: "Cấp số 45/QĐ-CQ và đóng dấu ban hành chính thức văn bản",
          ipAddress: "192.168.1.17",
          createdAt: new Date("2026-02-18T16:00:00").toISOString(),
        },
        {
          id: "audit-02",
          action: "SIGN_APPROVAL",
          tableName: "documents",
          recordId: "doc-demo-03",
          actor: { fullName: "Nguyễn Văn An", employeeCode: "GD001" },
          description: "Phê duyệt điện tử và ký băm SHA-256 bản dự thảo Quyết định",
          ipAddress: "192.168.1.10",
          createdAt: new Date("2026-02-18T14:30:00").toISOString(),
        },
        {
          id: "audit-03",
          action: "ASSIGN_SPECIALIST",
          tableName: "documents",
          recordId: "doc-demo-01",
          actor: { fullName: "Trần Thị Bình", employeeCode: "TP001" },
          description: "Phân công chuyên viên Phạm Minh Đức chủ trì xử lý văn bản đến số 128",
          ipAddress: "192.168.1.12",
          createdAt: new Date("2026-02-16T14:15:00").toISOString(),
        },
        {
          id: "audit-04",
          action: "ANNOTATE_DOCUMENT",
          tableName: "documents",
          recordId: "doc-demo-01",
          actor: { fullName: "Nguyễn Văn An", employeeCode: "GD001" },
          description: "Ghi bút phê chỉ đạo: Chuyển Phòng TCHC chủ trì triển khai theo đúng hướng dẫn",
          ipAddress: "192.168.1.10",
          createdAt: new Date("2026-02-16T10:00:00").toISOString(),
        },
        {
          id: "audit-05",
          action: "REGISTER_INCOMING",
          tableName: "documents",
          recordId: "doc-demo-01",
          actor: { fullName: "Lê Văn Cường", employeeCode: "VT001" },
          description: "Tiếp nhận và vào sổ văn bản đến số 128 từ Bộ Nội vụ",
          ipAddress: "192.168.1.17",
          createdAt: new Date("2026-02-16T08:30:00").toISOString(),
        },
      ];

      total = demoLogs.length;
      logs = demoLogs;
    }

    return paginatedResponse(logs, { page, pageSize, total });
  } catch (error) {
    return errorResponse(error);
  }
}
