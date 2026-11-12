// src/app/api/documents/incoming/route.ts
// API Danh sách và Tiếp nhận & Vào sổ Văn bản đến

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
} from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { DocumentStatus, UrgencyLevel } from "@prisma/client";
import { incomingDocumentSubmissionSchema } from "@/modules/document/schema";
import {
  incomingScope,
  hasRolePermission,
} from "@/modules/document/incoming/access";
import { nextIncomingNumber } from "@/modules/document/incoming/workflow";
import { claimUpload } from "@/lib/storage/claim-upload";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(
      1,
      parseInt(searchParams.get("pageSize") || "20", 10),
    );
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") as DocumentStatus | null;
    const urgency = searchParams.get("urgency") as UrgencyLevel | null;
    const bookId = searchParams.get("bookId");

    const where: Record<string, unknown> = { AND: [incomingScope(ctx)] };

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
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
            },
          },
        },
      }),
    ]);

    return paginatedResponse(documents, { page, pageSize, total });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requirePermission(Permissions.INCOMING_CREATE);
    if (!hasRolePermission(ctx, "CLERK", Permissions.INCOMING_CREATE))
      throw new BusinessError("FORBIDDEN");
    const body = await request.json();
    const parsed = incomingDocumentSubmissionSchema.safeParse({
      ...body,
      attachment: body.attachment ?? (body.fileKey ? body : undefined),
    });
    if (!parsed.success)
      throw new BusinessError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message,
      );
    const { attachment, documentBookId, documentTypeId, ...fields } =
      parsed.data;
    const newDoc = await prisma.$transaction(async (tx) => {
      const type = await tx.documentType.findFirst({
        where: {
          isActive: true,
          OR: [{ id: documentTypeId }, { code: documentTypeId }],
        },
      });
      if (!type)
        throw new BusinessError(
          "VALIDATION_ERROR",
          "Loại văn bản không tồn tại.",
        );
      const numbering = await nextIncomingNumber(
        tx,
        documentBookId,
        fields.receivedDate.getFullYear(),
      );
      const file = attachment
        ? await claimUpload(tx, ctx.userId, attachment)
        : undefined;
      const doc = await tx.document.create({
        data: {
          ...fields,
          ...numbering,
          documentTypeId: type.id,
          direction: "INCOMING",
          status: "RECEIVED",
          creatorId: ctx.userId,
          workflow: { create: { registrarId: ctx.userId } },
          files: file ? { create: file } : undefined,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: ctx.userId,
          action: "DOC_CREATE_INCOMING",
          tableName: "documents",
          recordId: doc.id,
          newState: { status: "RECEIVED" },
          reason: "Văn thư vào sổ văn bản đến",
        },
      });
      return doc;
    });
    return successResponse(newDoc, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
