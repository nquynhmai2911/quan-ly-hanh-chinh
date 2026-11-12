import { requireAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";

export async function GET() {
  try {
    const ctx = await requireAuth();
    if (
      !ctx.roleCodes.some((r) =>
        ["ADMIN", "CLERK", "LEADER", "DEPT_HEAD", "SPECIALIST"].includes(r),
      )
    ) {
      throw new BusinessError("FORBIDDEN");
    }

    const [people, units, books, citizens] = await Promise.all([
      prisma.user.findMany({
        where: {
          isActive: true,
          positions: {
            some: {
              startedAt: { lte: new Date() },
              endedAt: null,
              unit: { isActive: true },
              roles: {
                some: {
                  role: {
                    isActive: true,
                    code: { in: ["LEADER", "DEPT_HEAD", "SPECIALIST", "ADMIN"] },
                  },
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
              unit: { select: { id: true, name: true, code: true } },
              position: { select: { id: true, name: true } },
              roles: {
                select: {
                  role: { select: { code: true, name: true } },
                  dataScope: true,
                },
              },
            },
          },
        },
        orderBy: { fullName: "asc" },
      }),
      prisma.unit.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true, level: true, parentId: true },
        orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.documentBook.findMany({
        where: { isActive: true, bookType: "INCOMING" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          positions: {
            some: {
              roles: { some: { role: { code: "CITIZEN" } } },
            },
          },
        },
        select: { id: true, fullName: true, email: true, employeeCode: true },
        orderBy: { fullName: "asc" },
      }),
    ]);

    return successResponse({ people, units, books, citizens });
  } catch (error) {
    return errorResponse(error);
  }
}
