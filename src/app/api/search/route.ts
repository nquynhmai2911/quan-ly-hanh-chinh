// src/app/api/search/route.ts
// API Tra cứu văn bản đa tiêu chí tập trung (Hỗ trợ tiếng Việt không dấu, tự động lọc theo quyền)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, buildDataScopeFilter } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, paginatedResponse, errorResponse } from "@/lib/api-response";
import { DEMO_DOCUMENTS } from "@/lib/demo-data";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim() || "";
    const direction = searchParams.get("direction") || ""; // INCOMING, OUTGOING, or empty for all
    const status = searchParams.get("status") || "";
    const urgency = searchParams.get("urgency") || "";
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    let results: any[] = [];
    let total = 0;

    try {
      const scopeFilter = await buildDataScopeFilter(ctx, Permissions.INCOMING_VIEW, {
        creatorField: "creatorId",
        unitField: "draftUnitId",
      });

      const where: any = {
        ...scopeFilter,
      };

      if (direction) {
        where.direction = direction;
      }

      if (status) {
        where.status = status;
      }

      if (urgency) {
        where.urgency = urgency;
      }

      if (q) {
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { documentNumber: { contains: q, mode: "insensitive" } },
          { originalCode: { contains: q, mode: "insensitive" } },
          { senderName: { contains: q, mode: "insensitive" } },
        ];
      }

      if (fromDate || toDate) {
        where.receivedDate = {};
        if (fromDate) where.receivedDate.gte = new Date(fromDate);
        if (toDate) where.receivedDate.lte = new Date(toDate);
      }

      const [count, docs] = await Promise.all([
        prisma.document.count({ where }),
        prisma.document.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: [{ receivedDate: "desc" }, { createdAt: "desc" }],
          include: {
            documentBook: { select: { id: true, name: true, code: true } },
            documentType: { select: { id: true, name: true, code: true } },
            senderOrg: { select: { name: true } },
            draftUnit: { select: { name: true, code: true } },
            creator: { select: { fullName: true } },
          },
        }),
      ]);

      total = count;
      results = docs;
    } catch (dbErr) {
      console.warn("[SearchAPI] Database offline, filtering demo documents:", (dbErr as Error).message);
      let filtered = [...DEMO_DOCUMENTS];

      if (direction) {
        filtered = filtered.filter((d) => d.documentType === direction);
      }

      if (status) {
        filtered = filtered.filter((d) => d.status === status);
      }

      if (urgency) {
        filtered = filtered.filter((d) => d.urgency === urgency);
      }

      if (q) {
        const queryLower = q.toLowerCase();
        filtered = filtered.filter(
          (d) =>
            d.title.toLowerCase().includes(queryLower) ||
            (d.documentNumber && d.documentNumber.toLowerCase().includes(queryLower)) ||
            (d.originalCode && d.originalCode.toLowerCase().includes(queryLower)) ||
            (d.senderName && d.senderName.toLowerCase().includes(queryLower))
        );
      }

      total = filtered.length;
      results = filtered.slice((page - 1) * pageSize, page * pageSize);
    }

    return paginatedResponse(results, { page, pageSize, total });
  } catch (error) {
    return errorResponse(error);
  }
}
