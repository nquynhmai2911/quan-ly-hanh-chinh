import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { incomingScope } from "@/modules/document/incoming/access";
import {
  incomingActions,
  workflowInclude,
} from "@/modules/document/incoming/workflow";
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const id = request.nextUrl.searchParams.get("documentId");
    if (!id)
      throw new BusinessError(
        "VALIDATION_ERROR",
        "Vui lòng chọn văn bản cần phân công.",
      );
    const doc = await prisma.document.findFirst({
      where: { AND: [{ id }, incomingScope(ctx)] },
      include: workflowInclude,
    });
    if (
      !doc ||
      !incomingActions(ctx, doc).some((a) => a.action === "DEPT_HEAD_ASSIGN") ||
      !doc.workflow?.unitId
    )
      throw new BusinessError(
        "FORBIDDEN",
        "Văn bản chưa đến lượt bạn phân công.",
      );
    const positions = {
      startedAt: { lte: new Date() },
      endedAt: null,
      unitId: doc.workflow.unitId,
      unit: { isActive: true },
      position: { isActive: true },
      roles: { some: { role: { code: "SPECIALIST", isActive: true } } },
    };
    const users = await prisma.user.findMany({
      where: { isActive: true, positions: { some: positions } },
      orderBy: [{ fullName: "asc" }, { employeeCode: "asc" }],
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        positions: {
          where: positions,
          select: {
            unit: { select: { id: true, name: true } },
            roles: { select: { role: { select: { code: true, name: true } } } },
          },
        },
      },
    });
    return successResponse(users);
  } catch (error) {
    return errorResponse(error);
  }
}
