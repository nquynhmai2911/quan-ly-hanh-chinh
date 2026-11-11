// src/app/api/tasks/route.ts
// API Danh sách Công việc cá nhân được giao (tự động tính hạn xử lý, sắp đến hạn, quá hạn)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "ALL"; // ALL, PENDING, IN_PROGRESS, OVERDUE, COMPLETED

    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    let tasks: any[] = [];

    try {
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

      tasks = handlers.map((h) => {
        const deadline = h.deadline || h.document.processingDeadline;
        let isOverdue = false;
        let isDueSoon = false;

        if (deadline && h.status !== "CONFIRMED") {
          const d = new Date(deadline);
          if (d < now) isOverdue = true;
          else if (d <= threeDaysLater) isDueSoon = true;
        }

        return {
          id: h.id,
          documentId: h.documentId,
          documentNumber: h.document.documentNumber || h.document.originalCode || "Chưa cấp số",
          documentTitle: h.document.title,
          direction: h.document.direction,
          role: h.role, // MAIN, COORDINATE, INFO
          instruction: h.instruction || "Xử lý văn bản theo đúng thẩm quyền và thời hạn",
          assignerName: h.assigner?.fullName || "Lãnh đạo đơn vị",
          assignedAt: h.assignedAt,
          deadline,
          status: h.status, // ASSIGNED, PROCESSING, REPORTED, CONFIRMED, RETURNED
          progressPercent: h.status === "CONFIRMED" ? 100 : h.status === "REPORTED" ? 85 : 30,
          reportContent: h.reportContent,
          reportedAt: h.completedAt,
          urgency: h.document.urgency,
          security: h.document.security,
          isOverdue,
          isDueSoon,
        };
      });
    } catch (dbErr) {
      console.warn("[TasksAPI] Database offline, returning demo tasks:", (dbErr as Error).message);
      // Demo tasks
      tasks = [
        {
          id: "task-demo-01",
          documentId: "doc-demo-01",
          documentNumber: "128",
          documentTitle: "V/v Hướng dẫn triển khai công tác cải cách hành chính và chuyển đổi số năm 2026",
          direction: "INCOMING",
          role: "MAIN",
          instruction: "Chủ trì tổng hợp kế hoạch thực hiện trước ngày 28/02, tham mưu dự thảo Quyết định ban hành",
          assignerName: "Trần Thị Bình",
          assignedAt: new Date("2026-02-16T14:15:00").toISOString(),
          deadline: new Date("2026-03-01T17:00:00").toISOString(),
          status: "PROCESSING",
          progressPercent: 60,
          reportContent: "Đã hoàn thành dự thảo khung kế hoạch, đang xin ý kiến phối hợp các bộ phận liên quan.",
          reportedAt: null,
          urgency: "URGENT",
          security: "NORMAL",
          isOverdue: false,
          isDueSoon: true,
        },
        {
          id: "task-demo-02",
          documentId: "doc-demo-02",
          documentNumber: "86",
          documentTitle: "Triệu tập Hội nghị sơ kết công tác quý I và triển khai nhiệm vụ quý II năm 2026",
          direction: "INCOMING",
          role: "COORDINATE",
          instruction: "Chuẩn bị báo cáo tóm tắt số liệu kết quả quý I phục vụ đoàn công tác",
          assignerName: "Nguyễn Văn An",
          assignedAt: new Date("2026-02-21T08:00:00").toISOString(),
          deadline: new Date("2026-02-25T11:00:00").toISOString(),
          status: "PENDING",
          progressPercent: 10,
          reportContent: null,
          reportedAt: null,
          urgency: "FIRE",
          security: "NORMAL",
          isOverdue: false,
          isDueSoon: true,
        },
        {
          id: "task-demo-03",
          documentId: "doc-demo-04",
          documentNumber: "DRAFT-2026-09",
          documentTitle: "Tờ trình về việc phê duyệt dự toán kinh phí nâng cấp hạ tầng CNTT năm 2026",
          direction: "OUTGOING",
          role: "MAIN",
          instruction: "Soạn thảo dự thảo tờ trình, đính kèm báo cáo khảo sát và bảng dự toán chi tiết",
          assignerName: "Trần Thị Bình",
          assignedAt: new Date("2026-02-18T09:00:00").toISOString(),
          deadline: new Date("2026-02-22T17:00:00").toISOString(),
          status: "REPORTED",
          progressPercent: 90,
          reportContent: "Đã hoàn tất tờ trình và gửi Trưởng phòng duyệt.",
          reportedAt: new Date("2026-02-22T09:30:00").toISOString(),
          urgency: "URGENT",
          security: "NORMAL",
          isOverdue: false,
          isDueSoon: false,
        },
        {
          id: "task-demo-04",
          documentId: "doc-demo-03",
          documentNumber: "45/QĐ-CQ",
          documentTitle: "Quyết định về việc kiện toàn Hội đồng Thi đua - Khen thưởng cơ quan",
          direction: "OUTGOING",
          role: "INFO",
          instruction: "Nhận để biết và cập nhật danh sách hội đồng",
          assignerName: "Lê Văn Cường",
          assignedAt: new Date("2026-02-18T16:00:00").toISOString(),
          deadline: null,
          status: "COMPLETED",
          progressPercent: 100,
          reportContent: "Đã tiếp nhận và lưu hồ sơ theo dõi.",
          reportedAt: new Date("2026-02-19T08:00:00").toISOString(),
          urgency: "NORMAL",
          security: "NORMAL",
          isOverdue: false,
          isDueSoon: false,
        },
      ];
    }

    // Lọc theo filter
    let filtered = tasks;
    if (filter === "PENDING") {
      filtered = tasks.filter((t) => t.status === "PENDING" || t.status === "ASSIGNED");
    } else if (filter === "IN_PROGRESS") {
      filtered = tasks.filter((t) => t.status === "PROCESSING" || t.status === "REPORTED");
    } else if (filter === "OVERDUE") {
      filtered = tasks.filter((t) => t.isOverdue);
    } else if (filter === "DUE_SOON") {
      filtered = tasks.filter((t) => t.isDueSoon);
    } else if (filter === "COMPLETED") {
      filtered = tasks.filter((t) => t.status === "COMPLETED" || t.status === "CONFIRMED");
    }

    const counts = {
      all: tasks.length,
      pending: tasks.filter((t) => t.status === "PENDING" || t.status === "ASSIGNED").length,
      inProgress: tasks.filter((t) => t.status === "PROCESSING" || t.status === "REPORTED").length,
      overdue: tasks.filter((t) => t.isOverdue).length,
      dueSoon: tasks.filter((t) => t.isDueSoon).length,
      completed: tasks.filter((t) => t.status === "COMPLETED" || t.status === "CONFIRMED").length,
    };

    return successResponse({ tasks: filtered, counts });
  } catch (error) {
    return errorResponse(error);
  }
}
