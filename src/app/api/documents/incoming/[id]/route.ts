// src/app/api/documents/incoming/[id]/route.ts
// API Chi tiết Văn bản đến kèm Luồng xử lý, Handler, Files và Allowed Actions

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { getAllowedActions } from "@/modules/document/state-machine";
import { DEMO_DOCUMENTS } from "@/lib/demo-data";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requirePermission(Permissions.INCOMING_VIEW);
    const { id: docId } = await params;

    const doc = await prisma.document.findUnique({
      where: { id: docId, direction: "INCOMING" },
      include: {
        documentBook: { select: { id: true, name: true, code: true } },
        documentType: { select: { id: true, name: true, code: true } },
        field: { select: { id: true, name: true } },
        senderOrg: { select: { id: true, name: true, code: true, address: true, phone: true } },
        draftUnit: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, fullName: true, employeeCode: true } },
        handlers: {
          include: {
            assigner: { select: { id: true, fullName: true } },
            assignee: { select: { id: true, fullName: true, employeeCode: true } },
            unit: { select: { id: true, name: true, code: true } },
          },
          orderBy: [{ role: "asc" }, { assignedAt: "asc" }],
        },
        files: {
          where: { isCurrent: true },
          include: {
            uploader: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!doc) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản đến.");
    }

    // Lấy lịch sử Audit Trail của văn bản
    const auditLogs = await prisma.auditLog.findMany({
      where: { tableName: "documents", recordId: docId },
      include: {
        actor: { select: { id: true, fullName: true, employeeCode: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Lấy danh sách các nút hành động được phép cho người dùng hiện tại
    const allowedActions = getAllowedActions(doc.direction, doc.status, {
      userId: ctx.userId,
      userPositionId: ctx.primaryPosition?.userPositionId || "",
      roles: ctx.roleCodes,
      permissions: Array.from(ctx.permissions.keys()),
      dataScope: ctx.permissions.get(Permissions.INCOMING_VIEW) || "OWN",
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
        allMainHandlersReported:
          doc.handlers.filter((h) => h.role === "MAIN").length > 0 &&
          doc.handlers
            .filter((h) => h.role === "MAIN")
            .every((h) => h.status === "REPORTED" || h.status === "CONFIRMED"),
      },
    });

    return successResponse({
      document: doc,
      auditLogs,
      allowedActions,
    });
  } catch (error) {
    console.warn("[IncomingDocDetail] Database offline, checking DEMO_DOCUMENTS:", (error as Error).message);
    const { id: docId } = await params;
    const demoDoc = DEMO_DOCUMENTS.find((d) => d.id === docId);
    if (demoDoc) {
      return successResponse({
        document: {
          ...demoDoc,
          direction: "INCOMING",
          documentBook: demoDoc.documentBook,
          documentType: demoDoc.docType,
          field: { name: "Hành chính tổng hợp" },
          senderOrg: { name: demoDoc.senderName || "Cơ quan gửi" },
          handlers: demoDoc.handlers,
          files: demoDoc.files,
        },
        auditLogs: demoDoc.timeline,
        allowedActions: [
          {
            action: "DEPT_HEAD_ASSIGN",
            label: "Phân công xử lý",
            variant: "primary",
            targetStatus: "PROCESSING",
            requiresComment: false,
            confirmMessage: "Bạn có chắc chắn muốn xác nhận phân công thụ lý văn bản này?",
          },
        ],
      });
    }
    return errorResponse(error);
  }
}
