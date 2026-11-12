// src/app/api/tasks/route.ts
// API Danh sách Công việc cá nhân được giao (tự động tính hạn xử lý, sắp đến hạn, quá hạn)

import { incomingScope } from "@/modules/document/incoming/access";
import {
  incomingActions,
  workflowInclude,
} from "@/modules/document/incoming/workflow";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";

type TaskItem = {
  id: string;
  documentId: string;
  documentNumber: string;
  documentTitle: string;
  direction: string;
  canReport: boolean;
  role: string;
  instruction: string;
  assignerName: string;
  assignedAt: Date;
  deadline: Date | null;
  status: string;
  reportContent: string | null;
  reportedAt?: Date | null;
  urgency: string;
  security: string;
  isOverdue: boolean;
  isDueSoon: boolean;
};

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "ALL"; // ALL, PENDING, IN_PROGRESS, OVERDUE, COMPLETED

    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    let tasks: TaskItem[] = [];

    // Truy vấn từ bảng DocumentHandler mà user là assignee
    const handlers = await prisma.documentHandler.findMany({
      where: {
        assigneeId: ctx.userId,
      },
      include: {
        assigner: { select: { id: true, fullName: true, employeeCode: true } },
        document: {
          select: {
            id: true,
            title: true,
            documentNumber: true,
            originalCode: true,
            direction: true,
            status: true,
            urgency: true,
            security: true,
            processingDeadline: true,
            receivedDate: true,
            issuedDate: true,
          },
        },
      },
      orderBy: [{ deadline: "asc" }, { assignedAt: "desc" }],
    });

    tasks = handlers.map((h): TaskItem => {
      const deadline = h.deadline || h.document.processingDeadline;
      let isOverdue = false;
      let isDueSoon = false;

      if (
        deadline &&
        h.role !== "INFO" &&
        !["REPORTED", "CONFIRMED"].includes(h.status)
      ) {
        const d = new Date(deadline);
        if (d < now) isOverdue = true;
        else if (d <= threeDaysLater) isDueSoon = true;
      }

      return {
        id: h.id,
        documentId: h.documentId,
        documentNumber:
          h.document.documentNumber || h.document.originalCode || "Chưa cấp số",
        documentTitle: h.document.title,
        direction: h.document.direction,
        canReport:
          h.role !== "INFO" &&
          h.document.status === "PROCESSING" &&
          ["ASSIGNED", "PROCESSING", "RETURNED"].includes(h.status),
        role: h.role, // MAIN, COORDINATE, INFO
        instruction:
          h.instruction || "Xử lý văn bản theo đúng thẩm quyền và thời hạn",
        assignerName: h.assigner?.fullName || "Lãnh đạo đơn vị",
        assignedAt: h.assignedAt,
        deadline,
        status: h.status, // ASSIGNED, PROCESSING, REPORTED, CONFIRMED, RETURNED
        reportContent: h.reportContent,
        reportedAt: h.completedAt,
        urgency: h.document.urgency,
        security: h.document.security,
        isOverdue,
        isDueSoon,
      };
    });

    const queuedDocuments = await prisma.document.findMany({
      where: {
        AND: [
          incomingScope(ctx),
          {
            status: {
              in: [
                "SUBMITTED",
                "RECEIVED",
                "PENDING_LEADER",
                "DISTRIBUTED",
                "PROCESSING",
                "PENDING_REVIEW",
              ],
            },
          },
        ],
      },
      include: workflowInclude,
      orderBy: { updatedAt: "desc" },
    });
    for (const doc of queuedDocuments) {
      const actions = incomingActions(ctx, doc);
      if (!actions.length || tasks.some((t) => t.documentId === doc.id))
        continue;
      tasks.push({
        id: `workflow-${doc.id}`,
        documentId: doc.id,
        documentNumber: doc.documentNumber || doc.originalCode || "Chưa vào sổ",
        documentTitle: doc.title,
        direction: doc.direction,
        role: "INFO",
        instruction: `Đến lượt bạn: ${actions.map((a) => a.label).join(", ")}`,
        assignerName: doc.workflow?.leader?.fullName || "Bộ phận tiếp nhận",
        assignedAt: doc.updatedAt,
        deadline: doc.processingDeadline,
        status: "ASSIGNED",
        canReport: false,
        reportContent: null,
        urgency: doc.urgency,
        security: doc.security,
        isOverdue: !!doc.processingDeadline && doc.processingDeadline < now,
        isDueSoon:
          !!doc.processingDeadline &&
          doc.processingDeadline >= now &&
          doc.processingDeadline <= threeDaysLater,
      });
    }

    // Lọc theo filter
    let filtered = tasks;
    if (filter === "PENDING") {
      filtered = tasks.filter(
        (t) => t.status === "PENDING" || t.status === "ASSIGNED",
      );
    } else if (filter === "IN_PROGRESS") {
      filtered = tasks.filter(
        (t) => t.status === "PROCESSING" || t.status === "REPORTED",
      );
    } else if (filter === "OVERDUE") {
      filtered = tasks.filter((t) => t.isOverdue);
    } else if (filter === "DUE_SOON") {
      filtered = tasks.filter((t) => t.isDueSoon);
    } else if (filter === "COMPLETED") {
      filtered = tasks.filter(
        (t) => t.status === "COMPLETED" || t.status === "CONFIRMED",
      );
    }

    const counts = {
      all: tasks.length,
      pending: tasks.filter(
        (t) => t.status === "PENDING" || t.status === "ASSIGNED",
      ).length,
      inProgress: tasks.filter(
        (t) => t.status === "PROCESSING" || t.status === "REPORTED",
      ).length,
      overdue: tasks.filter((t) => t.isOverdue).length,
      dueSoon: tasks.filter((t) => t.isDueSoon).length,
      completed: tasks.filter(
        (t) => t.status === "COMPLETED" || t.status === "CONFIRMED",
      ).length,
    };

    return successResponse({ tasks: filtered, counts });
  } catch (error) {
    return errorResponse(error);
  }
}
