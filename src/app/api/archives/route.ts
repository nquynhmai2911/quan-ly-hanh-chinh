// src/app/api/archives/route.ts
// API quản lý Hồ sơ công việc lưu trữ văn bản

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, buildDataScopeFilter } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
} from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(Permissions.ARCHIVE_VIEW);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(
      1,
      parseInt(searchParams.get("pageSize") || "20", 10),
    );
    const search = searchParams.get("search")?.trim() || "";

    const where: Record<string, unknown> = {
      AND: [
        await buildDataScopeFilter(ctx, Permissions.ARCHIVE_VIEW, {
          unitField: "unitId",
        }),
      ],
    };
    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, archives] = await Promise.all([
      prisma.archive.count({ where }),
      prisma.archive.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ year: "desc" }, { createdAt: "desc" }],
        include: {
          unit: { select: { id: true, name: true, code: true } },
          creator: { select: { id: true, fullName: true } },
          _count: { select: { documents: true } },
        },
      }),
    ]);

    return paginatedResponse(archives, { page, pageSize, total });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(Permissions.ARCHIVE_MANAGE);

    const body = await request.json();
    const {
      code,
      title,
      year = new Date().getFullYear(),
      retentionPeriod = "10 năm",
      description,
    } = body;

    if (!code || !title) {
      throw new BusinessError(
        "VALIDATION_ERROR",
        "Mã hồ sơ và Tiêu đề không được để trống.",
      );
    }

    const existing = await prisma.archive.findUnique({
      where: { code },
    });

    if (existing) {
      throw new BusinessError("CONFLICT", `Mã hồ sơ '${code}' đã tồn tại.`);
    }

    if (!ctx.primaryPosition?.unitId)
      throw new BusinessError(
        "VALIDATION_ERROR",
        "Tài khoản chưa được gán phòng ban lập hồ sơ.",
      );
    const newArchive = await prisma.archive.create({
      data: {
        code,
        title,
        year: Number(year),
        retentionPeriod,
        description: description || null,
        unitId: ctx.primaryPosition.unitId,
        creatorId: ctx.userId,
      },
    });

    return successResponse(newArchive, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
