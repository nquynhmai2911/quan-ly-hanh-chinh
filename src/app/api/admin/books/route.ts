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
    await requirePermission(Permissions.CATALOG_MANAGE);

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
    console.warn("[AdminBooks] Database offline, returning demo books:", (error as Error).message);
    return successResponse([
      {
        id: "book-demo-01",
        name: "Sổ văn bản đến chung",
        code: "SVB-DEN",
        bookType: "INCOMING",
        numberTemplate: "{number}",
        counters: [{ year: 2026, lastNumber: 128 }],
        _count: { documents: 128 },
      },
      {
        id: "book-demo-02",
        name: "Sổ Công văn đi - TCHC",
        code: "SCV-TCHC",
        bookType: "OUTGOING",
        numberTemplate: "{number}/{typeCode}-{unitCode}",
        counters: [{ year: 2026, lastNumber: 45 }],
        _count: { documents: 45 },
      },
      {
        id: "book-demo-03",
        name: "Sổ Quyết định",
        code: "SQD",
        bookType: "OUTGOING",
        numberTemplate: "{number}/{typeCode}-{unitCode}",
        counters: [{ year: 2026, lastNumber: 22 }],
        _count: { documents: 22 },
      },
    ]);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(Permissions.CATALOG_MANAGE);

    const body = await request.json();
    const parsed = documentBookSchema.safeParse(body);

    if (!parsed.success) {
      throw new BusinessError("VALIDATION_ERROR", parsed.error.issues[0]?.message);
    }

    const { name, code, bookType, unitId, documentTypeId, numberTemplate, description } = parsed.data;

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
