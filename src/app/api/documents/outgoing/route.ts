// src/app/api/documents/outgoing/route.ts
// API Danh sách và Khởi tạo dự thảo Văn bản đi / Tờ trình

import { claimUpload } from "@/lib/storage/claim-upload";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireAuth, buildDataScopeFilter } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import {
  successResponse,
  paginatedResponse,
  errorResponse,
} from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { createOutgoingDraftSchema } from "@/modules/document/schema";
import { DocumentStatus, UrgencyLevel, SecurityLevel } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requirePermission(Permissions.OUTGOING_VIEW);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(
      1,
      parseInt(searchParams.get("pageSize") || "20", 10),
    );
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") as DocumentStatus | null;
    const urgency = searchParams.get("urgency") as UrgencyLevel | null;

    // Sinh điều kiện phân quyền Data Scope
    const dataScopeFilter = await buildDataScopeFilter(
      ctx,
      Permissions.OUTGOING_VIEW,
      {
        creatorField: "creatorId",
        unitField: "draftUnitId",
      },
    );

    const where: Record<string, unknown> = {
      direction: "OUTGOING",
      AND: [dataScopeFilter],
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
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const canCreate =
      ctx.roleCodes.includes("ADMIN") ||
      ctx.permissions.has(Permissions.OUTGOING_CREATE);
    if (!canCreate)
      throw new BusinessError(
        "FORBIDDEN",
        "Bạn không có quyền soạn thảo văn bản đi.",
      );

    const body = await request.json();
    const parsed = createOutgoingDraftSchema.safeParse(body);

    if (!parsed.success) {
      throw new BusinessError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message,
      );
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
      recipientType,
      recipientId,
      relatedDocumentId,
      sendType,
      summaryNotes,
    } = parsed.data;

    if (
      !ctx.roleCodes.some((r) => ["ADMIN", "LEADER", "CLERK"].includes(r)) &&
      !ctx.positions.some((p) => p.unitId === draftUnitId)
    )
      throw new BusinessError(
        "FORBIDDEN",
        "Chỉ được soạn thảo cho phòng ban của mình.",
      );
    const uploadIds: string[] = Array.isArray(body.uploadIds)
      ? body.uploadIds
      : [];
    if (uploadIds.length > 10 || uploadIds.some((id) => typeof id !== "string"))
      throw new BusinessError(
        "VALIDATION_ERROR",
        "Danh sách tệp không hợp lệ.",
      );

    // Tạo dự thảo trong giao dịch cơ sở dữ liệu
    const newDraft = await prisma.$transaction(async (tx) => {
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
      if (
        documentBookId &&
        !(await tx.documentBook.findFirst({
          where: { id: documentBookId, bookType: "OUTGOING", isActive: true },
        }))
      )
        throw new BusinessError(
          "VALIDATION_ERROR",
          "Sổ văn bản đi không hợp lệ.",
        );
      const files = [];
      for (const uploadId of uploadIds)
        files.push(await claimUpload(tx, ctx.userId, { uploadId }));
      const doc = await tx.document.create({
        data: {
          direction: "OUTGOING",
          status: "DRAFT",
          title,
          documentTypeId: type.id,
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
          files: { create: files },
        },
      });

      // Xử lý luồng nhận theo 2 nhánh: Chuyên viên (Nhiệm vụ/Chỉ đạo nội bộ) hoặc Người dân (Phản hồi/Kết quả)
      if (recipientType === "SPECIALIST" && recipientId) {
        const specUser = await tx.user.findUnique({
          where: { id: recipientId },
          include: { positions: { where: { endedAt: null } } },
        });
        if (specUser) {
          await tx.documentHandler.create({
            data: {
              documentId: doc.id,
              assignerId: ctx.userId,
              assigneeId: specUser.id,
              unitId: specUser.positions[0]?.unitId || draftUnitId,
              role: "MAIN",
              instruction: summaryNotes || "Nhận chỉ đạo, nhiệm vụ, văn bản nội bộ",
            },
          });
          await tx.notification.create({
            data: {
              recipientId: specUser.id,
              actorId: ctx.userId,
              documentId: doc.id,
              type: "DOC_ASSIGNED",
              title: "Chỉ đạo / Văn bản đi nội bộ mới",
              content: `Bạn nhận được chỉ đạo/văn bản nội bộ: "${title}"`,
            },
          });
        }
      } else if (recipientType === "CITIZEN" && recipientId) {
        const citizenUser = await tx.user.findUnique({
          where: { id: recipientId },
        });
        if (citizenUser) {
          if (relatedDocumentId) {
            await tx.documentRelation.create({
              data: {
                sourceDocumentId: relatedDocumentId,
                targetDocumentId: doc.id,
                relationType: "REPLY_TO",
              },
            });
          }
          await tx.notification.create({
            data: {
              recipientId: citizenUser.id,
              actorId: ctx.userId,
              documentId: doc.id,
              type: "DOC_ASSIGNED",
              title: "Văn bản phản hồi / kết quả giải quyết",
              content: `Cơ quan đã ban hành văn bản phản hồi / kết quả: "${title}"`,
            },
          });
        }
      }

      // Tạo chuỗi duyệt nối tiếp mặc định
      const deptHead =
        (await tx.userPositionRole.findFirst({
          where: {
            role: { code: { in: ["DEPT_HEAD", "LEADER"] } },
            userPosition: { unitId: draftUnitId, endedAt: null },
          },
          select: { userPosition: { select: { userId: true } } },
        })) ||
        (await tx.userPositionRole.findFirst({
          where: {
            role: { code: { in: ["DEPT_HEAD", "LEADER"] } },
            userPosition: { endedAt: null },
          },
          select: { userPosition: { select: { userId: true } } },
        }));

      const leader =
        (await tx.userPositionRole.findFirst({
          where: {
            role: { code: "LEADER" },
            userPosition: {
              endedAt: null,
              unit: { level: 0 },
              ...(deptHead?.userPosition.userId
                ? { userId: { not: deptHead.userPosition.userId } }
                : {}),
            },
          },
          select: { userPosition: { select: { userId: true } } },
        })) ||
        (await tx.userPositionRole.findFirst({
          where: {
            role: { code: "LEADER" },
            userPosition: {
              endedAt: null,
              ...(deptHead?.userPosition.userId
                ? { userId: { not: deptHead.userPosition.userId } }
                : {}),
            },
          },
          select: { userPosition: { select: { userId: true } } },
        })) ||
        (await tx.userPositionRole.findFirst({
          where: {
            role: { code: "LEADER" },
            userPosition: { endedAt: null },
          },
          select: { userPosition: { select: { userId: true } } },
        }));

      if (!deptHead || !leader)
        throw new BusinessError(
          "VALIDATION_ERROR",
          "Chưa cấu hình trưởng phòng hoặc lãnh đạo duyệt cho đơn vị.",
        );

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
  } catch (error) {
    return errorResponse(error);
  }
}
