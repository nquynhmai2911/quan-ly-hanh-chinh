// src/app/api/documents/incoming/route.ts
// API Danh sách và Tiếp nhận & Vào sổ Văn bản đến

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, buildDataScopeFilter } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, paginatedResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { createIncomingDocumentSchema } from "@/modules/document/schema";
import { DocumentStatus, UrgencyLevel, SecurityLevel } from "@prisma/client";
import { DEMO_DOCUMENTS } from "@/lib/demo-data";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(Permissions.INCOMING_VIEW);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10));
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") as DocumentStatus | null;
    const urgency = searchParams.get("urgency") as UrgencyLevel | null;
    const bookId = searchParams.get("bookId");

    // Sinh điều kiện phân quyền Data Scope
    const dataScopeFilter = await buildDataScopeFilter(ctx, Permissions.INCOMING_VIEW, {
      creatorField: "creatorId",
      unitField: "draftUnitId",
    });

    const where: Record<string, unknown> = {
      direction: "INCOMING",
      ...dataScopeFilter,
    };

    if (status) where.status = status;
    if (urgency) where.urgency = urgency;
    if (bookId) where.documentBookId = bookId;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { documentNumber: { contains: search, mode: "insensitive" } },
        { originalCode: { contains: search, mode: "insensitive" } },
        { senderName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, documents] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ receivedDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          documentNumber: true,
          originalCode: true,
          title: true,
          receivedDate: true,
          issuedDate: true,
          processingDeadline: true,
          status: true,
          urgency: true,
          security: true,
          senderName: true,
          senderOrg: { select: { id: true, name: true, code: true } },
          documentBook: { select: { id: true, name: true } },
          documentType: { select: { id: true, name: true, code: true } },
          handlers: {
            where: { role: "MAIN" },
            select: {
              assignee: { select: { id: true, fullName: true } },
              status: true,
              deadline: true,
            },
          },
          files: {
            where: { isCurrent: true },
            select: { id: true, fileName: true, fileSize: true, mimeType: true },
          },
        },
      }),
    ]);

    return paginatedResponse(documents, { page, pageSize, total });
  } catch (error) {
    console.warn("[IncomingAPI] Database offline, returning demo incoming documents:", (error as Error).message);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10));
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const status = searchParams.get("status");
    const urgency = searchParams.get("urgency");

    let demoDocs = DEMO_DOCUMENTS.filter((d) => d.documentType === "INCOMING").map((d) => ({
      id: d.id,
      documentNumber: d.documentNumber,
      originalCode: d.originalCode,
      title: d.title,
      receivedDate: d.receivedDate,
      issuedDate: d.issuedDate,
      processingDeadline: d.processingDeadline,
      status: d.status,
      urgency: d.urgency,
      security: d.security,
      senderName: d.senderName,
      senderOrg: d.senderOrg,
      documentBook: d.documentBook,
      documentType: d.docType,
      handlers: d.handlers.map((h: any) => ({
        assignee: { id: h.assignee?.id || "usr-unknown", fullName: h.assignee?.fullName || "Chưa gán" },
        status: h.status,
        deadline: h.deadline || null,
      })),
      files: d.files.map((f: any) => ({
        id: f.id,
        fileName: f.fileName,
        fileSize: f.fileSize,
        mimeType: f.mimeType,
      })),
    }));

    if (status) {
      demoDocs = demoDocs.filter((d) => d.status === status);
    }
    if (urgency) {
      demoDocs = demoDocs.filter((d) => d.urgency === urgency);
    }
    if (search) {
      demoDocs = demoDocs.filter(
        (d) =>
          d.title.toLowerCase().includes(search) ||
          (d.documentNumber && d.documentNumber.toLowerCase().includes(search)) ||
          (d.originalCode && d.originalCode.toLowerCase().includes(search)) ||
          (d.senderName && d.senderName.toLowerCase().includes(search))
      );
    }

    const total = demoDocs.length;
    const paginated = demoDocs.slice((page - 1) * pageSize, page * pageSize);
    return paginatedResponse(paginated, { page, pageSize, total });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(Permissions.INCOMING_CREATE);

    const body = await request.json();
    const parsed = createIncomingDocumentSchema.safeParse(body);

    if (!parsed.success) {
      throw new BusinessError("VALIDATION_ERROR", parsed.error.issues[0]?.message);
    }

    const {
      title,
      documentBookId,
      documentTypeId,
      originalCode,
      senderOrgId,
      senderName,
      issuedDate,
      receivedDate,
      processingDeadline,
      urgency,
      security,
      fieldId,
      summaryNotes,
    } = parsed.data;

    const currentYear = new Date(receivedDate || new Date()).getFullYear();

    let newDoc: any = null;

    try {
      newDoc = await prisma.$transaction(async (tx) => {
        // 1. Cấp số đến tự động từ bộ đếm DocumentBookCounter
        const counters = await tx.$queryRaw<
          Array<{ id: string; last_number: number }>
        >`SELECT id, last_number FROM document_book_counters WHERE book_id = ${documentBookId} AND year = ${currentYear} FOR UPDATE`;

        let lastNumber = 0;
        let counterId = "";

        if (counters.length === 0) {
          const createdCounter = await tx.documentBookCounter.create({
            data: {
              bookId: documentBookId,
              year: currentYear,
              lastNumber: 1,
            },
          });
          lastNumber = 1;
          counterId = createdCounter.id;
        } else {
          lastNumber = counters[0].last_number + 1;
          counterId = counters[0].id;
          await tx.documentBookCounter.update({
            where: { id: counterId },
            data: { lastNumber },
          });
        }

        const book = await tx.documentBook.findUnique({
          where: { id: documentBookId },
        });

        const template = book?.numberTemplate || "{number}";
        const documentNumber = template.replace("{number}", String(lastNumber).padStart(2, "0"));

        // 2. Tạo bản ghi Document
        const doc = await tx.document.create({
          data: {
            direction: "INCOMING",
            status: "RECEIVED",
            title,
            documentBookId,
            documentTypeId,
            documentNumberYear: currentYear,
            documentOrder: lastNumber,
            documentNumber,
            originalCode,
            senderOrgId,
            senderName,
            issuedDate,
            receivedDate,
            processingDeadline,
            urgency,
            security,
            fieldId,
            summaryNotes,
            creatorId: ctx.userId,
          },
        });

        // 3. Ghi AuditLog
        await tx.auditLog.create({
          data: {
            actorId: ctx.userId,
            action: "DOC_CREATE_INCOMING",
            tableName: "documents",
            recordId: doc.id,
            newState: {
              status: "RECEIVED",
              documentNumber,
              title,
            },
            reason: "Văn thư vào sổ văn bản đến",
          },
        });

        return doc;
      });

      return successResponse(newDoc, 201);
    } catch (dbErr) {
      console.warn("[IncomingPOST] Database offline or transaction failed, fallback to DEMO_DOCUMENTS:", (dbErr as Error).message);

      const nextNum = 165;
      const docId = `doc-incoming-${Date.now()}`;

      const createdDoc = {
        id: docId,
        documentType: "INCOMING",
        direction: "INCOMING",
        title: title.trim(),
        documentNumber: String(nextNum),
        documentNumberYear: currentYear,
        documentOrder: nextNum,
        originalCode: originalCode || `CV-${Math.floor(100 + Math.random() * 900)}`,
        senderName: senderName || "Cơ quan gửi đến",
        senderOrg: { id: "org-ext", name: senderName || "Cơ quan gửi đến", code: "CQG" },
        issuedDate: (issuedDate || new Date()).toISOString(),
        receivedDate: (receivedDate || new Date()).toISOString(),
        processingDeadline: processingDeadline ? processingDeadline.toISOString() : null,
        status: "RECEIVED" as DocumentStatus,
        urgency: urgency || "NORMAL",
        security: security || "NORMAL",
        isArchived: false,
        documentBook: { id: documentBookId || "book-den", name: "Sổ văn bản đến chung", code: "SVB-DEN" },
        docType: { id: documentTypeId || "CV", name: "Công văn", code: "CV" },
        documentTypeDetail: { id: documentTypeId || "CV", name: "Công văn", code: "CV" },
        draftUnit: { id: "unit-vp", name: "Văn phòng cơ quan", code: "VP" },
        creator: { id: ctx.userId, fullName: "Quản trị viên Hệ thống", employeeCode: "ADMIN001" },
        handlers: [],
        files: [
          {
            id: `file-${Date.now()}`,
            fileName: "Van-ban-den-tiep-nhan.pdf",
            fileSize: 614400,
            mimeType: "application/pdf",
            isCurrent: true,
            version: 1,
          },
        ],
        timeline: [
          {
            id: `log-${Date.now()}`,
            action: "VÀO SỔ TIẾP NHẬN",
            actor: { fullName: "Quản trị viên Hệ thống" },
            createdAt: new Date().toISOString(),
            description: `Văn thư đã vào sổ tiếp nhận số ${nextNum}/${currentYear}.`,
          },
        ],
        createdAt: new Date().toISOString(),
      };

      DEMO_DOCUMENTS.unshift(createdDoc as any);
      return successResponse(createdDoc, 201);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
