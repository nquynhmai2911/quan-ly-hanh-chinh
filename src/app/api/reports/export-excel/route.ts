// src/app/api/reports/export-excel/route.ts
// API Xuất dữ liệu Sổ văn bản theo chuẩn Phụ lục IV Nghị định 30/2020/NĐ-CP ra file CSV UTF-8 BOM

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { DEMO_DOCUMENTS } from "@/lib/demo-data";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const bookType = searchParams.get("bookType") || "INCOMING"; // INCOMING or OUTGOING
    const year = searchParams.get("year") || "2026";

    let docs: any[] = [];

    try {
      docs = await prisma.document.findMany({
        where: {
          direction: bookType as any,
        },
        orderBy: [{ documentOrder: "asc" }, { createdAt: "desc" }],
        include: {
          documentBook: true,
          documentType: true,
          senderOrg: true,
          draftUnit: true,
          handlers: {
            where: { role: "MAIN" },
            include: { assignee: true },
          },
        },
      });
    } catch {
      // Fallback lấy chính xác 5 văn bản mẫu từ DEMO_DOCUMENTS
      docs = DEMO_DOCUMENTS.filter((d) => d.documentType === bookType);
    }

    // Nếu DB trống, fallback về DEMO_DOCUMENTS
    if (docs.length === 0) {
      docs = DEMO_DOCUMENTS.filter((d) => d.documentType === bookType);
    }

    let csv = "\uFEFF"; // UTF-8 BOM
    let filename = "";

    if (bookType === "INCOMING") {
      filename = `So_Dang_Ky_Van_Ban_Den_${year}.csv`;
      csv += "STT,Số đến,Ngày đến,Tác giả văn bản (Nơi gửi),Số ký hiệu gốc,Ngày văn bản,Tên loại và trích yếu nội dung,Đơn vị hoặc người nhận,Hạn giải quyết,Độ khẩn,Trạng thái\n";

      docs.forEach((doc, idx) => {
        const num = doc.documentNumber || String(idx + 1);
        const receivedDate = doc.receivedDate ? new Date(doc.receivedDate).toLocaleDateString("vi-VN") : "";
        const sender = doc.senderOrg?.name || doc.senderName || "Nội bộ";
        const origCode = doc.originalCode || "";
        const issuedDate = doc.issuedDate ? new Date(doc.issuedDate).toLocaleDateString("vi-VN") : "";
        const titleClean = (doc.title || "").replace(/"/g, '""');
        const receiver = doc.handlers?.[0]?.assignee?.fullName || doc.draftUnit?.name || "Chưa phân công";
        const deadline = doc.processingDeadline ? new Date(doc.processingDeadline).toLocaleDateString("vi-VN") : "Không";
        const urgency = doc.urgency === "FIRE" ? "Hỏa tốc" : doc.urgency === "URGENT" ? "Khẩn" : "Thường";
        const status = doc.status;

        csv += `"${idx + 1}","${num}","${receivedDate}","${sender}","${origCode}","${issuedDate}","${titleClean}","${receiver}","${deadline}","${urgency}","${status}"\n`;
      });
    } else {
      filename = `So_Dang_Ky_Van_Ban_Di_${year}.csv`;
      csv += "STT,Số và ký hiệu văn bản,Ngày tháng văn bản,Tên loại văn bản,Trích yếu nội dung,Người ký,Đơn vị soạn thảo,Nơi nhận văn bản,Độ khẩn,Trạng thái\n";

      docs.forEach((doc, idx) => {
        const num = doc.documentNumber || `Dự thảo-${idx + 1}`;
        const issuedDate = doc.issuedDate ? new Date(doc.issuedDate).toLocaleDateString("vi-VN") : "";
        const typeName = doc.documentType?.name || doc.docType?.name || "Văn bản";
        const titleClean = (doc.title || "").replace(/"/g, '""');
        const signer = doc.signerName || "Nguyễn Văn An";
        const unit = doc.draftUnit?.name || "Phòng TCHC";
        const recipients = (doc.recipientsSummary || "Các đơn vị trực thuộc").replace(/"/g, '""');
        const urgency = doc.urgency === "FIRE" ? "Hỏa tốc" : doc.urgency === "URGENT" ? "Khẩn" : "Thường";
        const status = doc.status;

        csv += `"${idx + 1}","${num}","${issuedDate}","${typeName}","${titleClean}","${signer}","${unit}","${recipients}","${urgency}","${status}"\n`;
      });
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Xuất dữ liệu thất bại." }, { status: 500 });
  }
}
