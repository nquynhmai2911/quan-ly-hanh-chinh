import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { claimUpload } from "@/lib/storage/claim-upload";
import { notify } from "@/modules/document/incoming/workflow";

const schema = z.object({
  senderName: z.string().trim().min(2).max(255),
  senderPhone: z.string().trim().min(7).max(30),
  senderEmail: z.union([z.email(), z.literal("")]).optional(),
  senderAddress: z.string().max(500).optional(),
  title: z.string().trim().min(5).max(1000),
  note: z.string().max(1000).optional(),
  docType: z.string().trim().min(1, "Vui lòng chọn hoặc nhập loại hồ sơ"),
  urgency: z.enum(["NORMAL", "URGENT", "FIRE"]).default("NORMAL"),
  attachments: z
    .array(z.object({ uploadId: z.string().min(1) }))
    .min(1, "Vui lòng đính kèm ít nhất một tệp gốc.")
    .max(10, "Mỗi hồ sơ tối đa 10 tệp."),
});
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    if (!ctx.roleCodes.some((r) => ["CITIZEN", "ADMIN"].includes(r)))
      throw new BusinessError(
        "FORBIDDEN",
        "Chức năng nộp trực tuyến dành cho tài khoản người dân.",
      );
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      throw new BusinessError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message,
      );
    const body = parsed.data;
    const result = await prisma.$transaction(async (tx) => {
      const files = [];
      for (const ref of body.attachments)
        files.push(await claimUpload(tx, ctx.userId, ref));
      // Tìm loại hồ sơ khớp theo ID, Tên hoặc Ký hiệu
      let type = await tx.documentType.findFirst({
        where: {
          isActive: true,
          OR: [
            { id: body.docType },
            { name: body.docType },
            { code: body.docType },
          ],
        },
      });

      // Nếu không khớp trực tiếp, ưu tiên loại CV hoặc loại hoạt động đầu tiên
      if (!type) {
        type = await tx.documentType.findFirst({
          where: {
            isActive: true,
            code: body.docType === "Báo cáo tình hình" ? "BC" : "CV",
          },
        });
      }

      if (!type) {
        type = await tx.documentType.findFirst({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        });
      }

      if (!type) {
        throw new BusinessError(
          "CONFLICT",
          "Chưa cấu hình loại văn bản trên hệ thống. Vui lòng liên hệ quản trị viên.",
        );
      }
      const onlineCode = `DTT-${new Date().getFullYear()}-${randomUUID().slice(0, 13).toUpperCase()}`;
      const doc = await tx.document.create({
        data: {
          direction: "INCOMING",
          status: "SUBMITTED",
          title: body.title,
          summaryNotes: body.note,
          originalCode: onlineCode,
          senderName: body.senderName,
          urgency: body.urgency,
          documentTypeId: type.id,
          creatorId: ctx.userId,
          workflow: {
            create: {
              trackingCode: onlineCode,
              senderPhone: body.senderPhone,
              senderEmail: body.senderEmail,
              senderAddress: body.senderAddress,
              submissionType: body.docType,
            },
          },
          files: { create: files },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: ctx.userId,
          action: "DOC_CITIZEN_SUBMIT",
          tableName: "documents",
          recordId: doc.id,
          newState: { status: "SUBMITTED", filesCount: files.length },
          reason: `Nộp hồ sơ trực tuyến: ${onlineCode}`,
        },
      });
      const receivers = await tx.user.findMany({
        where: {
          isActive: true,
          positions: {
            some: {
              endedAt: null,
              roles: {
                some: {
                  role: {
                    code: { in: ["SPECIALIST", "LEADER", "ADMIN"] },
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        select: { id: true },
      });
      await notify(
        tx,
        ctx,
        doc.id,
        receivers.map((u) => u.id),
        "Hồ sơ trực tuyến chờ tiếp nhận",
        `Hồ sơ ${onlineCode}: ${doc.title}`,
      );
      return {
        id: doc.id,
        onlineCode,
        message: "Hồ sơ và tệp đính kèm đã được lưu, chờ tiếp nhận xử lý.",
      };
    });
    return successResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  try {
    const ctx = await requireAuth();
    const documents = await prisma.document.findMany({
      where: {
        creatorId: ctx.userId,
        direction: "INCOMING",
        workflow: { trackingCode: { not: null } },
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        workflow: { select: { trackingCode: true } },
        files: { select: { id: true, fileName: true, fileSize: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return successResponse(documents);
  } catch (error) {
    return errorResponse(error);
  }
}
