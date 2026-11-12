import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { reportIncoming } from "@/modules/document/incoming/workflow";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const task = await prisma.documentHandler.findFirst({
      where: { id, assigneeId: ctx.userId },
      include: {
        document: {
          include: { files: true, documentBook: true, documentType: true },
        },
        assigner: { select: { fullName: true, employeeCode: true } },
        assignee: { select: { fullName: true, employeeCode: true } },
      },
    });
    if (!task)
      throw new BusinessError(
        "NOT_FOUND",
        "Không tìm thấy công việc được giao cho bạn.",
      );
    return successResponse(task);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    if (
      typeof body.reportContent !== "string" ||
      (body.status && body.status !== "REPORTED")
    )
      throw new BusinessError(
        "VALIDATION_ERROR",
        "Chỉ được nộp báo cáo kết quả của mình.",
      );
    const task = await prisma.documentHandler.findFirst({
      where: { id, assigneeId: ctx.userId },
    });
    if (!task)
      throw new BusinessError(
        "NOT_FOUND",
        "Không tìm thấy công việc được giao cho bạn.",
      );
    return successResponse(
      await reportIncoming(ctx, task.documentId, body.reportContent),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
