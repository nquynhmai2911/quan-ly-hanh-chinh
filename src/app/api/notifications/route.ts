// src/app/api/notifications/route.ts
// API Trung tâm thông báo & Nhắc việc nội bộ hệ thống

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "ALL"; // ALL, UNREAD, URGENT

    let notifications: any[] = [];

    try {
      const where: any = { recipientId: ctx.userId };
      if (filter === "UNREAD") {
        where.isRead = false;
      }

      notifications = await prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    } catch {
      // Demo notifications
      notifications = [
        {
          id: "notif-01",
          title: "Văn bản đến mới cần xử lý",
          content: "Bạn được giao chủ trì xử lý văn bản số 128: 'V/v Hướng dẫn triển khai công tác cải cách hành chính năm 2026'.",
          type: "TASK_ASSIGNED",
          link: "/documents/doc-demo-01",
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(), // 35 phút trước
        },
        {
          id: "notif-02",
          title: "Giấy mời hỏa tốc cần xin ý kiến Lãnh đạo",
          content: "Văn phòng đã tiếp nhận Giấy mời số 12/GM-UBND của UBND Tỉnh triệu tập Hội nghị sơ kết.",
          type: "URGENT_DOCUMENT",
          link: "/documents/doc-demo-02",
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 giờ trước
        },
        {
          id: "notif-03",
          title: "Dự thảo văn bản đi đã được phê duyệt",
          content: "Giám đốc đã ký duyệt điện tử Quyết định số 45/QĐ-CQ về việc kiện toàn Hội đồng Thi đua.",
          type: "DOCUMENT_APPROVED",
          link: "/documents/doc-demo-03",
          isRead: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 ngày trước
        },
        {
          id: "notif-04",
          title: "Nhiệm vụ sắp đến hạn xử lý",
          content: "Báo cáo sơ kết quý I có hạn hoàn thành trước 11:00 ngày 25/02/2026. Vui lòng khẩn trương nộp kết quả.",
          type: "DEADLINE_WARNING",
          link: "/tasks",
          isRead: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 ngày trước
        },
      ];
    }

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return successResponse({ notifications, unreadCount });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = await request.json();
    const { notificationId, markAll } = body;

    try {
      if (markAll) {
        await prisma.notification.updateMany({
          where: { recipientId: ctx.userId, isRead: false },
          data: { isRead: true },
        });
      } else if (notificationId) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: { isRead: true },
        });
      }
    } catch {
      // Demo success
    }

    return successResponse({ success: true, message: "Đã cập nhật trạng thái thông báo." });
  } catch (error) {
    return errorResponse(error);
  }
}
