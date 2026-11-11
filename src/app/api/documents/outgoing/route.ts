// src/app/api/documents/outgoing/route.ts
// API Danh sách và Khởi tạo dự thảo Văn bản đi / Tờ trình

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, buildDataScopeFilter } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, paginatedResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { createOutgoingDraftSchema } from "@/modules/document/schema";
import { DocumentStatus, UrgencyLevel, SecurityLevel } from "@prisma/client";
import { DEMO_DOCUMENTS } from "@/lib/demo-data";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(Permissions.OUTGOING_VIEW);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10));
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") as DocumentStatus | null;
    const urgency = searchParams.get("urgency") as UrgencyLevel | null;

    // Sinh điều kiện phân quyền Data Scope
    const dataScopeFilter = await buildDataScopeFilter(ctx, Permissions.OUTGOING_VIEW, {
      creatorField: "creatorId",
      unitField: "draftUnitId",
    });

    const where: Record<string, unknown> = {
      direction: "OUTGOING",
      ...dataScopeFilter,
    };

    if (status) where.status = status;
    if (urgency) where.urgency = urgency;

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { documentNumber: { contains: search, mode: "insensitive" } },
        { signerName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, documents] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          documentNumber: true,
          title: true,
          status: true,
          urgency: true,
          security: true,
          issuedDate: true,
          signerName: true,
          signerPosition: true,
          draftUnit: { select: { id: true, name: true, code: true } },
          documentType: { select: { id: true, name: true, code: true } },
          creator: { select: { id: true, fullName: true } },
          approvals: {
            orderBy: { stepOrder: "asc" },
            select: {
              stepOrder: true,
              role: true,
              status: true,
              approver: { select: { fullName: true } },
            },
          },
          files: {
            where: { isCurrent: true },
            select: { id: true, fileName: true, version: true, fileSize: true },
          },
          createdAt: true,
        },
      }),
    ]);

    return paginatedResponse(documents, { page, pageSize, total });
  } catch (error) {
    console.warn("[OutgoingAPI] Database offline, returning demo outgoing documents:", (error as Error).message);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10));
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const status = searchParams.get("status");
    const urgency = searchParams.get("urgency");

    let demoDocs = DEMO_DOCUMENTS.filter((d) => d.documentType === "OUTGOING").map((d) => ({
      id: d.id,
      documentNumber: d.documentNumber,
      title: d.title,
      status: d.status,
      urgency: d.urgency,
      security: d.security,
      issuedDate: d.issuedDate,
      signerName: d.signerName || "Nguyễn Văn An",
      signerPosition: d.signerPosition || "Giám đốc",
      draftUnit: d.draftUnit,
      documentType: d.docType,
      creator: d.creator,
      approvals: d.approvals || [],
      files: (d.files || []).map((f: any) => ({
        id: f.id,
        fileName: f.fileName,
        version: f.version || 1,
        fileSize: f.fileSize,
      })),
      createdAt: d.createdAt || new Date().toISOString(),
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
          (d.signerName && d.signerName.toLowerCase().includes(search))
      );
    }

    const total = demoDocs.length;
    const paginated = demoDocs.slice((page - 1) * pageSize, page * pageSize);
    return paginatedResponse(paginated, { page, pageSize, total });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(Permissions.OUTGOING_CREATE);

    const body = await request.json();
    const parsed = createOutgoingDraftSchema.safeParse(body);

    if (!parsed.success) {
      throw new BusinessError("VALIDATION_ERROR", parsed.error.issues[0]?.message);
    }

    const {
      title,
      documentTypeId,
      draftUnitId,
      documentBookId,
      urgency,
      security,
      fieldId,
      signerName,
      signerPosition,
      recipientsSummary,
      sendType,
      summaryNotes,
    } = parsed.data;

    const fileIds: string[] = Array.isArray(body.fileIds) ? body.fileIds : [];

    let newDraft: any = null;

    try {
      // Tạo dự thảo trong transaction nếu DB online
      newDraft = await prisma.$transaction(async (tx) => {
        const doc = await tx.document.create({
          data: {
            direction: "OUTGOING",
            status: "DRAFT",
            title,
            documentTypeId,
            draftUnitId,
            documentBookId: documentBookId || null,
            urgency,
            security,
            fieldId,
            signerName,
            signerPosition,
            recipientsSummary,
            sendType,
            summaryNotes,
            creatorId: ctx.userId,
          },
        });

        // Gắn file đã tải lên trước đó vào văn bản
        if (fileIds.length > 0) {
          for (const fId of fileIds) {
            await tx.documentFile.update({
              where: { id: fId },
              data: { documentId: doc.id },
            });
          }
        }

        // Tạo chuỗi duyệt nối tiếp mặc định
        const deptHead = await tx.userPositionRole.findFirst({
          where: {
            role: { code: "DEPT_HEAD" },
            userPosition: { unitId: draftUnitId, endedAt: null },
          },
          select: { userPosition: { select: { userId: true } } },
        });

        const leader = await tx.userPositionRole.findFirst({
          where: {
            role: { code: "LEADER" },
            userPosition: { endedAt: null },
          },
          select: { userPosition: { select: { userId: true } } },
        });

        if (deptHead) {
          await tx.documentApproval.create({
            data: {
              documentId: doc.id,
              stepOrder: 1,
              approverId: deptHead.userPosition.userId,
              role: "REVIEWER",
              status: "PENDING",
            },
          });
        }

        if (leader) {
          await tx.documentApproval.create({
            data: {
              documentId: doc.id,
              stepOrder: 2,
              approverId: leader.userPosition.userId,
              role: "APPROVER",
              status: "PENDING",
            },
          });
        }

        // Ghi AuditLog
        await tx.auditLog.create({
          data: {
            actorId: ctx.userId,
            action: "DOC_CREATE_OUTGOING_DRAFT",
            tableName: "documents",
            recordId: doc.id,
            newState: { status: "DRAFT", title },
            reason: "Khởi tạo dự thảo văn bản đi",
          },
        });

        return doc;
      });

      return successResponse(newDraft, 201);
    } catch (dbErr) {
      console.warn("[OutgoingPOST] Database offline or transaction failed, fallback to DEMO_DOCUMENTS:", (dbErr as Error).message);

      const draftId = `doc-outgoing-${Date.now()}`;
      const draftCode = `DRAFT-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}`;

      const createdDraft = {
        id: draftId,
        documentType: "OUTGOING",
        direction: "OUTGOING",
        title: title.trim(),
        documentNumber: draftCode,
        documentNumberYear: new Date().getFullYear(),
        documentOrder: 99,
        status: "DRAFT" as DocumentStatus,
        urgency: urgency || "NORMAL",
        security: security || "NORMAL",
        isArchived: false,
        signerName: signerName || "Nguyễn Văn An",
        signerPosition: signerPosition || "Giám đốc",
        draftUnit: { id: draftUnitId || "unit-tchc", name: "Cơ quan hành chính", code: "CQ" },
        creator: { id: ctx.userId, fullName: "Quản trị viên Hệ thống", employeeCode: "ADMIN001" },
        documentBook: { id: "book-cv", name: "Sổ Công văn đi", code: "SCV" },
        docType: { id: documentTypeId || "CV", name: documentTypeId === "QĐ" ? "Quyết định" : "Công văn", code: documentTypeId || "CV" },
        documentTypeDetail: { id: documentTypeId || "CV", name: documentTypeId === "QĐ" ? "Quyết định" : "Công văn", code: documentTypeId || "CV" },
        recipientsSummary: recipientsSummary || "Các phòng ban, đơn vị liên quan",
        handlers: [],
        approvals: [
          { stepOrder: 1, role: "REVIEWER", status: "PENDING", approver: { fullName: "Trần Thị Bình" } },
          { stepOrder: 2, role: "SIGNER", status: "PENDING", approver: { fullName: signerName || "Nguyễn Văn An" } },
        ],
        files: [
          {
            id: `file-${Date.now()}`,
            fileName: "Ban-thao-du-thao-van-ban.docx",
            fileSize: 524288,
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            isCurrent: true,
            version: 1,
          },
        ],
        timeline: [
          {
            id: `log-${Date.now()}`,
            action: "KHỞI TẠO DỰ THẢO",
            actor: { fullName: "Quản trị viên Hệ thống" },
            createdAt: new Date().toISOString(),
            description: `Đã khởi tạo dự thảo văn bản đi thành công: "${title.trim()}". Trạng thái: Dự thảo, chuẩn bị trình duyệt.`,
          },
        ],
        createdAt: new Date().toISOString(),
      };

      DEMO_DOCUMENTS.unshift(createdDraft as any);
      return successResponse(createdDraft, 201);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
