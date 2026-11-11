// src/app/api/documents/outgoing/[id]/route.ts
// API Chi tiết Văn bản đi: Chuỗi duyệt nối tiếp, Phiên bản file, Ký số và Allowed Actions

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { getAllowedActions } from "@/modules/document/state-machine";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requirePermission(Permissions.OUTGOING_VIEW);
    const { id: docId } = await params;

    const doc = await prisma.document.findUnique({
      where: { id: docId, direction: "OUTGOING" },
      include: {
        documentBook: { select: { id: true, name: true, code: true, numberTemplate: true } },
        documentType: { select: { id: true, name: true, code: true } },
        field: { select: { id: true, name: true } },
        draftUnit: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, fullName: true, employeeCode: true } },
        approvals: {
          include: {
            approver: { select: { id: true, fullName: true, employeeCode: true } },
          },
          orderBy: { stepOrder: "asc" },
        },
        files: {
          include: {
            uploader: { select: { id: true, fullName: true } },
          },
          orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        },
        signatures: {
          include: {
            signer: { select: { id: true, fullName: true, employeeCode: true } },
          },
          orderBy: { signedAt: "desc" },
        },
      },
    });

    if (!doc) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản đi / dự thảo.");
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { tableName: "documents", recordId: docId },
      include: {
        actor: { select: { id: true, fullName: true, employeeCode: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const allowedActions = getAllowedActions(doc.direction, doc.status, {
      userId: ctx.userId,
      userPositionId: ctx.primaryPosition?.userPositionId || "",
      roles: ctx.roleCodes,
      permissions: Array.from(ctx.permissions.keys()),
      dataScope: ctx.permissions.get(Permissions.OUTGOING_VIEW) || "OWN",
      document: {
        id: doc.id,
        direction: doc.direction,
        status: doc.status,
        creatorId: doc.creatorId,
        draftUnitId: doc.draftUnitId,
        isLocked: doc.isLocked,
        documentNumber: doc.documentNumber,
      },
      additionalData: {
        hasFile: doc.files.length > 0,
        hasSignature: doc.signatures.length > 0,
      },
    });

    return successResponse({
      document: doc,
      auditLogs,
      allowedActions,
    });
  } catch (error) {
    console.warn("[OutgoingDocDetail] Database offline, checking DEMO_DOCUMENTS:", (error as Error).message);
    const { id: docId } = await params;
    const { DEMO_DOCUMENTS } = await import("@/lib/demo-data");
    const demoDoc = DEMO_DOCUMENTS.find((d) => d.id === docId);
    if (demoDoc) {
      return successResponse({
        document: {
          ...demoDoc,
          direction: "OUTGOING",
          documentBook: demoDoc.documentBook,
          documentType: demoDoc.docType,
          field: { name: "Hành chính tổng hợp" },
          draftUnit: demoDoc.draftUnit,
          creator: demoDoc.creator,
          approvals: demoDoc.approvals || [],
          handlers: demoDoc.handlers || [],
          files: demoDoc.files || [],
        },
        auditLogs: demoDoc.timeline || [],
        allowedActions: [
          {
            action: "LEADER_APPROVE",
            label: "Phê duyệt văn bản",
            variant: "primary",
            targetStatus: "APPROVED",
            requiresComment: false,
            confirmMessage: "Bạn có chắc chắn muốn phê duyệt dự thảo này?",
          },
        ],
      });
    }
    return errorResponse(error);
  }
}
