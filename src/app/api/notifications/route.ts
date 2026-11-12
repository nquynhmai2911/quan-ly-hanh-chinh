import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guard";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const filter = request.nextUrl.searchParams.get("filter");
    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: ctx.userId,
        ...(filter === "UNREAD" ? { isRead: false } : {}),
        ...(filter === "URGENT"
          ? { document: { urgency: { in: ["URGENT", "FIRE"] } } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({
      where: { recipientId: ctx.userId, isRead: false },
    });
    return successResponse({
      notifications: notifications.map((n) => ({
        ...n,
        link: n.documentId ? `/documents/${n.documentId}` : "/notifications",
      })),
      unreadCount,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { notificationId, markAll } = await request.json();
    if (!markAll && typeof notificationId !== "string")
      throw new BusinessError("VALIDATION_ERROR", "Vui lòng chọn thông báo.");
    const result = await prisma.notification.updateMany({
      where: {
        recipientId: ctx.userId,
        ...(markAll ? { isRead: false } : { id: notificationId }),
      },
      data: { isRead: true, readAt: new Date() },
    });
    if (!markAll && !result.count)
      throw new BusinessError("NOT_FOUND", "Không tìm thấy thông báo của bạn.");
    return successResponse({ message: "Đã cập nhật thông báo." });
  } catch (error) {
    return errorResponse(error);
  }
}
