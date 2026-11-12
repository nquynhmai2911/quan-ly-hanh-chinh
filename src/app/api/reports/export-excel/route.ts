import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { documentScope } from "@/modules/document/access";
import { errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { documentStatusLabels } from "@/lib/display-labels";
const cell = (value: unknown) => {
  const text = String(value ?? "");
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
};
const date = (value: Date | null) =>
  value ? value.toLocaleDateString("vi-VN") : "";
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const bookType = request.nextUrl.searchParams.get("bookType") || "INCOMING";
    const year = Number(
      request.nextUrl.searchParams.get("year") || new Date().getFullYear(),
    );
    if (
      !["INCOMING", "OUTGOING"].includes(bookType) ||
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 2200
    )
      throw new BusinessError(
        "VALIDATION_ERROR",
        "Loại sổ hoặc năm không hợp lệ.",
      );
    const docs = await prisma.document.findMany({
      where: {
        AND: [
          await documentScope(ctx),
          {
            direction: bookType as "INCOMING" | "OUTGOING",
            documentNumberYear: year,
            documentNumber: { not: null },
          },
        ],
      },
      orderBy: { documentOrder: "asc" },
      include: {
        documentType: true,
        senderOrg: true,
        draftUnit: true,
        workflow: { include: { unit: true } },
        handlers: {
          where: { role: "MAIN" },
          include: { assignee: { select: { fullName: true } } },
        },
      },
    });
    const rows: unknown[][] =
      bookType === "INCOMING"
        ? [
            [
              "STT",
              "Số đến",
              "Ngày đến",
              "Nơi gửi",
              "Số ký hiệu gốc",
              "Ngày văn bản",
              "Trích yếu",
              "Người hoặc đơn vị xử lý",
              "Hạn xử lý",
              "Độ khẩn",
              "Trạng thái",
            ],
          ]
        : [
            [
              "STT",
              "Số văn bản",
              "Ngày văn bản",
              "Loại văn bản",
              "Trích yếu",
              "Người ký",
              "Đơn vị soạn thảo",
              "Nơi nhận",
              "Độ khẩn",
              "Trạng thái",
            ],
          ];
    docs.forEach((d, i) => {
      const urgency =
        d.urgency === "FIRE"
          ? "Hỏa tốc"
          : d.urgency === "URGENT"
            ? "Khẩn"
            : "Thường";
      const status = documentStatusLabels[d.status];
      rows.push(
        bookType === "INCOMING"
          ? [
              i + 1,
              d.documentNumber,
              date(d.receivedDate),
              d.senderOrg?.name || d.senderName,
              d.originalCode,
              date(d.issuedDate),
              d.title,
              d.handlers[0]?.assignee.fullName ||
                d.workflow?.unit?.name ||
                "Chưa phân công",
              date(d.processingDeadline),
              urgency,
              status,
            ]
          : [
              i + 1,
              d.documentNumber,
              date(d.issuedDate),
              d.documentType.name,
              d.title,
              d.signerName,
              d.draftUnit?.name,
              d.recipientsSummary,
              urgency,
              status,
            ],
      );
    });
    return new NextResponse(
      "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n"),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="So_van_ban_${bookType === "INCOMING" ? "den" : "di"}_${year}.csv"`,
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
