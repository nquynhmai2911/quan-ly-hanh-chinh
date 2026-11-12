import { requireAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
export async function GET() {
  try {
    const ctx = await requireAuth();
    if (
      !ctx.roleCodes.some((r) =>
        ["ADMIN", "CLERK", "LEADER", "DEPT_HEAD"].includes(r),
      )
    )
      throw new BusinessError("FORBIDDEN");
    const people = await prisma.user.findMany({
      where: {
        isActive: true,
        positions: {
          some: {
            startedAt: { lte: new Date() },
            endedAt: null,
            unit: { isActive: true },
            roles: {
              some: {
                role: { isActive: true, code: { in: ["LEADER", "DEPT_HEAD"] } },
              },
            },
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        positions: {
          where: { endedAt: null, unit: { isActive: true } },
          select: {
            unit: { select: { id: true, name: true } },
            roles: { select: { role: { select: { code: true } } } },
          },
        },
      },
      orderBy: { fullName: "asc" },
    });
    const books = await prisma.documentBook.findMany({
      where: { isActive: true, bookType: "INCOMING" },
      select: { id: true, name: true, code: true },
    });
    return successResponse({ people, books });
  } catch (error) {
    return errorResponse(error);
  }
}
