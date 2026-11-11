// src/app/api/citizen/submit-document/route.ts
// API tiếp nhận văn bản / đơn kiến nghị trực tuyến từ Người dân & Doanh nghiệp

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { DEMO_DOCUMENTS } from "@/lib/demo-data";
import { DocumentStatus, UrgencyLevel, SecurityLevel } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await request.json();

    const {
      senderName,
      senderPhone,
      senderEmail,
      senderAddress,
      title,
      docType,
      urgency = "NORMAL",
      fileName,
      fileSize,
      fileKey,
      note,
    } = body;

    if (!title || !title.trim()) {
      throw new BusinessError("VALIDATION_ERROR", "Vui lòng nhập trích yếu nội dung văn bản.");
    }
    if (!senderName || !senderName.trim()) {
      throw new BusinessError("VALIDATION_ERROR", "Vui lòng nhập họ tên người gửi hoặc tên doanh nghiệp.");
    }

    const onlineCode = `DTT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const newDoc = {
      id: `doc-citizen-${Date.now()}`,
      documentType: "INCOMING" as const,
      direction: "INCOMING" as const,
      title: title.trim(),
      documentNumber: null, // Chờ văn thư vào sổ cấp số đến chính thức
      documentNumberYear: new Date().getFullYear(),
      documentOrder: 999,
      originalCode: onlineCode,
      senderName: senderName.trim(),
      senderOrg: {
        id: "org-citizen",
        name: `${senderName.trim()} (Người dân / Doanh nghiệp)`,
        code: "CD-DN",
        address: senderAddress || "Toàn quốc",
        phone: senderPhone || "",
      },
      issuedDate: new Date().toISOString(),
      receivedDate: new Date().toISOString(),
      processingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "RECEIVED" as DocumentStatus, // Chờ văn thư thẩm tra và vào sổ tiếp nhận
      urgency: (urgency as UrgencyLevel) || "NORMAL",
      security: "NORMAL" as SecurityLevel,
      isArchived: false,
      summaryNotes: note || `Đơn kiến nghị / Phản ánh nộp trực tuyến qua Cổng tiếp nhận. Người gửi: ${senderName.trim()} - SĐT: ${senderPhone || "Chưa có"}`,
      documentBook: { id: "book-den", name: "Sổ văn bản đến chung", code: "SVB-DEN" },
      docType: { id: "type-kn", name: docType || "Đơn kiến nghị / Phản ánh", code: "KN" },
      documentTypeDetail: { id: "type-kn", name: docType || "Đơn kiến nghị / Phản ánh", code: "KN" },
      draftUnit: { id: "unit-vp", name: "Văn phòng cơ quan (Bộ phận Tiếp nhận)", code: "VP" },
      creator: { id: ctx.userId, fullName: senderName.trim(), employeeCode: "CITIZEN" },
      handlers: [],
      files: [
        {
          id: `file-${Date.now()}`,
          fileName: fileName || "Don-kien-nghi-truc-tuyen.pdf",
          fileSize: fileSize || 450000,
          fileKey: fileKey || null,
          mimeType: fileName?.endsWith(".docx") || fileName?.endsWith(".doc") ? "application/msword" : "application/pdf",
          isCurrent: true,
          version: 1,
        },
      ],
      timeline: [
        {
          id: `log-${Date.now()}`,
          action: "NỘP VĂN BẢN TRỰC TUYẾN",
          actor: { fullName: senderName.trim() },
          createdAt: new Date().toISOString(),
          description: `Người dân đã nộp văn bản trực tuyến thành công. Mã hồ sơ tra cứu: ${onlineCode}. Chờ Văn thư tiếp nhận vào sổ.`,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    // Đẩy vào DEMO_DOCUMENTS để hiển thị ngay lập tức trong toàn hệ thống
    DEMO_DOCUMENTS.unshift(newDoc as any);

    try {
      // Nếu DB online thì ghi vào Postgres
      const defaultType = await prisma.documentType.findFirst();
      if (defaultType) {
        await prisma.document.create({
          data: {
            direction: "INCOMING",
            title: newDoc.title,
            originalCode: onlineCode,
            senderName: newDoc.senderName,
            status: "RECEIVED",
            urgency: newDoc.urgency,
            security: "NORMAL",
            creatorId: ctx.userId,
            documentTypeId: defaultType.id,
          },
        });
      }
    } catch {}

    return successResponse({
      id: newDoc.id,
      onlineCode,
      message: `Đã gửi văn bản thành công! Mã tra cứu hồ sơ: ${onlineCode}`,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
