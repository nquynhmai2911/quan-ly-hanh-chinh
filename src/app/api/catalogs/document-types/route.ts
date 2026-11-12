// src/app/api/catalogs/document-types/route.ts
// API lấy danh sách Loại hồ sơ / Loại văn bản đang hoạt động cho form nộp & tạo văn bản

import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const types = await prisma.documentType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
      },
    });

    return successResponse(types);
  } catch (error) {
    return errorResponse(error);
  }
}

