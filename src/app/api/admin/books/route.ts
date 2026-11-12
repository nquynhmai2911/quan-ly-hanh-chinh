// src/app/api/admin/books/route.ts
// API quản lý cấu hình Sổ văn bản và bộ đếm số theo năm

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { documentBookSchema } from "@/modules/catalog/schema";
import { BookType } from "@prisma/client";

export async function GET() {
  try {
    await requirePermission(Permissions.CATALOG_VIEW);

    const currentYear = new Date().getFullYear();

    const books = await prisma.documentBook.findMany({
      orderBy: [{ bookType: "asc" }, { createdAt: "desc" }],
      include: {
        unit: { select: { id: true, name: true, code: true } },
        documentType: { select: { id: true, name: true, code: true } },
        counters: {
          where: { year: currentYear },
          select: { year: true, lastNumber: true },
        },
        _count: { select: { documents: true } },
      },
    });

    return successResponse(books);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(Permissions.CATALOG_MANAGE);

    const body = await request.json();
    const parsed = documentBookSchema.safeParse(body);

    if (!parsed.success) {
      throw new BusinessError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message,
      );
    }

    const {
      name,
      code,
      bookType,
      unitId,
      documentTypeId,
      numberTemplate,
      description,
    } = parsed.data;

    const existing = await prisma.documentBook.findUnique({
      where: { code },
    });

    if (existing) {
      throw new BusinessError("CONFLICT", `Mã sổ '${code}' đã tồn tại.`);
    }

    const currentYear = new Date().getFullYear();

    const newBook = await prisma.$transaction(async (tx) => {
      const book = await tx.documentBook.create({
        data: {
          name,
          code,
          bookType: bookType as BookType,
          unitId: unitId || null,
          documentTypeId: documentTypeId || null,
          numberTemplate,
          description: description || null,
        },
      });

      // Khởi tạo bộ đếm cho năm hiện tại
      await tx.documentBookCounter.create({
        data: {
          bookId: book.id,
          year: currentYear,
          lastNumber: 0,
        },
      });

      return book;
    });

    return successResponse(newBook, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
