import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { documentScope } from "@/modules/document/access";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const year = Number(
      request.nextUrl.searchParams.get("year") || new Date().getFullYear(),
    );
    if (!Number.isInteger(year) || year < 1900 || year > 2200)
      throw new BusinessError("VALIDATION_ERROR", "Năm báo cáo không hợp lệ.");
    const docs = await prisma.document.findMany({
      where: {
        AND: [
          await documentScope(ctx),
          {
            createdAt: {
              gte: new Date(year, 0, 1),
              lt: new Date(year + 1, 0, 1),
            },
          },
        ],
      },
      include: {
        documentType: true,
        workflow: { include: { unit: true } },
        draftUnit: true,
        senderOrg: true,
        handlers: {
          where: { role: "MAIN" },
          include: { assignee: { select: { fullName: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const completed = (d: (typeof docs)[number]) =>
      ["COMPLETED", "ISSUED"].includes(d.status);
    const overdue = (d: (typeof docs)[number]) =>
      !!d.processingDeadline &&
      !completed(d) &&
      d.processingDeadline < new Date();
    const onTime = (d: (typeof docs)[number]) =>
      completed(d) &&
      (!d.processingDeadline || d.updatedAt <= d.processingDeadline);
    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
      month: `T${i + 1}`,
      incoming: 0,
      outgoing: 0,
      completed: 0,
      overdue: 0,
    }));
    const departments = new Map<
      string,
      {
        unitName: string;
        code: string;
        total: number;
        completed: number;
        onTime: number;
      }
    >();
    const types = new Map<string, { typeName: string; count: number }>();
    for (const d of docs) {
      const m = monthlyStats[d.createdAt.getMonth()];
      if (d.direction === "INCOMING") m.incoming++;
      else m.outgoing++;
      if (completed(d)) m.completed++;
      if (overdue(d)) m.overdue++;
      const unit = d.workflow?.unit || d.draftUnit;
      if (unit) {
        const row = departments.get(unit.id) || {
          unitName: unit.name,
          code: unit.code,
          total: 0,
          completed: 0,
          onTime: 0,
        };
        row.total++;
        if (completed(d)) row.completed++;
        if (onTime(d)) row.onTime++;
        departments.set(unit.id, row);
      }
      const type = types.get(d.documentTypeId) || {
        typeName: d.documentType.name,
        count: 0,
      };
      type.count++;
      types.set(d.documentTypeId, type);
    }
    const incoming = docs.filter((d) => d.direction === "INCOMING"),
      outgoing = docs.filter((d) => d.direction === "OUTGOING");
    const completeCount = docs.filter(completed).length;
    return successResponse({
      year,
      summary: {
        totalIncoming: incoming.length,
        totalOutgoing: outgoing.length,
        totalCompleted: completeCount,
        totalOverdue: docs.filter(overdue).length,
        avgOnTimeRate: completeCount
          ? Math.round((docs.filter(onTime).length * 100) / completeCount)
          : 0,
        annualIncoming: incoming.length,
        annualOutgoing: outgoing.length,
      },
      monthlyStats,
      deptStats: [...departments.values()].map((d) => ({
        unitName: d.unitName,
        code: d.code,
        total: d.total,
        onTimeRate: d.completed
          ? Math.round((d.onTime * 100) / d.completed)
          : 0,
      })),
      docTypeStats: [...types.values()].map((t) => ({
        ...t,
        percent: docs.length ? Math.round((t.count * 100) / docs.length) : 0,
      })),
      sampleIncoming: incoming.slice(0, 5),
      sampleOutgoing: outgoing.slice(0, 5),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
