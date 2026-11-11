// src/app/api/documents/outgoing/[id]/sign/route.ts
// API Phê duyệt điện tử & Ký số văn bản đi (Lãnh đạo cơ quan)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { defaultSignatureProvider } from "@/lib/signature";
import { executeDocumentTransition } from "@/modules/document/state-machine";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requirePermission(Permissions.OUTGOING_APPROVE);
    const { id: docId } = await params;

    const doc = await prisma.document.findUnique({
      where: { id: docId, direction: "OUTGOING" },
      include: {
        files: { where: { isCurrent: true }, orderBy: { version: "desc" } },
      },
    });

    if (!doc) {
      throw new BusinessError("NOT_FOUND", "Không tìm thấy văn bản đi.");
    }

    if (doc.status !== "PENDING_APPROVAL") {
      throw new BusinessError(
        "INVALID_TRANSITION",
        `Văn bản đang ở trạng thái '${doc.status}', chỉ có thể ký khi ở trạng thái 'PENDING_APPROVAL'.`
      );
    }

    const currentFile = doc.files[0];
    if (!currentFile) {
      throw new BusinessError("VALIDATION_ERROR", "Dự thảo không có file đính kèm để ký số.");
    }

    // 1. Thực hiện phê duyệt điện tử (lưu hash SHA-256)
    const sigResult = await defaultSignatureProvider.signDocument({
      documentId: doc.id,
      fileId: currentFile.id,
      signerId: ctx.userId,
      fileHash: currentFile.fileHash,
      certificateInfo: {
        signerName: ctx.fullName,
        signerEmployeeCode: ctx.employeeCode,
        position: ctx.primaryPosition?.positionName || "Lãnh đạo",
        signedTime: new Date().toISOString(),
        fileHash: currentFile.fileHash,
      },
    });

    // 2. Chuyển trạng thái văn bản sang APPROVED qua State Machine
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    const updated = await executeDocumentTransition(
      prisma,
      {
        documentId: doc.id,
        action: "LEADER_APPROVE",
        actorId: ctx.userId,
        reason: "Lãnh đạo phê duyệt và ký số điện tử",
        ipAddress: ip,
        userAgent,
      },
      {
        userId: ctx.userId,
        userPositionId: ctx.primaryPosition?.userPositionId || "",
        roles: ctx.roleCodes,
        permissions: Array.from(ctx.permissions.keys()),
        dataScope: ctx.permissions.get(Permissions.OUTGOING_APPROVE) || "ALL",
        document: {
          id: doc.id,
          direction: doc.direction,
          status: doc.status,
          creatorId: doc.creatorId,
          draftUnitId: doc.draftUnitId,
          isLocked: doc.isLocked,
          documentNumber: doc.documentNumber,
        },
      }
    );

    return successResponse({
      signature: sigResult,
      document: updated,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
