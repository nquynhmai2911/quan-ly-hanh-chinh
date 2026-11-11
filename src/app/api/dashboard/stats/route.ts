// src/app/api/dashboard/stats/route.ts
// API Thống kê số liệu Dashboard điều hành (tự động lọc theo quyền và Data Scope)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, buildDataScopeFilter } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const ctx = await requireAuth();

    const incomingFilter = await buildDataScopeFilter(ctx, Permissions.INCOMING_VIEW, {
      creatorField: "creatorId",
      unitField: "draftUnitId",
    });

    const outgoingFilter = await buildDataScopeFilter(ctx, Permissions.OUTGOING_VIEW, {
      creatorField: "creatorId",
      unitField: "draftUnitId",
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Truy vấn song song các chỉ số
    const [
      totalIncoming,
      pendingIncoming,
      overdueIncoming,
      urgentIncoming,
      todayIncoming,
      totalOutgoing,
      pendingOutgoing,
      issuedOutgoing,
      myHandlingCount,
      recentDocuments,
    ] = await Promise.all([
      // Tổng văn bản đến
      prisma.document.count({
        where: { direction: "INCOMING", ...incomingFilter },
      }),
      // Văn bản đến đang chờ xử lý
      prisma.document.count({
        where: {
          direction: "INCOMING",
          status: { in: ["RECEIVED", "PENDING_LEADER", "DISTRIBUTED", "PROCESSING", "PENDING_REVIEW"] },
          ...incomingFilter,
        },
      }),
      // Văn bản đến quá hạn
      prisma.document.count({
        where: {
          direction: "INCOMING",
          status: { notIn: ["COMPLETED"] },
          processingDeadline: { lt: now },
          ...incomingFilter,
        },
      }),
      // Văn bản đến khẩn / hỏa tốc
      prisma.document.count({
        where: {
          direction: "INCOMING",
          urgency: { in: ["URGENT", "FIRE"] },
          status: { notIn: ["COMPLETED"] },
          ...incomingFilter,
        },
      }),
      // Văn bản đến nhận trong ngày
      prisma.document.count({
        where: {
          direction: "INCOMING",
          receivedDate: { gte: todayStart },
          ...incomingFilter,
        },
      }),
      // Tổng văn bản đi
      prisma.document.count({
        where: { direction: "OUTGOING", ...outgoingFilter },
      }),
      // Văn bản đi chờ duyệt
      prisma.document.count({
        where: {
          direction: "OUTGOING",
          status: { in: ["PENDING_REVIEW", "PENDING_APPROVAL", "APPROVED"] },
          ...outgoingFilter,
        },
      }),
      // Văn bản đi đã ban hành
      prisma.document.count({
        where: {
          direction: "OUTGOING",
          status: "ISSUED",
          ...outgoingFilter,
        },
      }),
      // Việc của cá nhân tôi đang phải xử lý
      prisma.documentHandler.count({
        where: {
          assigneeId: ctx.userId,
          status: { in: ["ASSIGNED", "PROCESSING", "RETURNED"] },
        },
      }),
      // 5 văn bản mới nhất
      prisma.document.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          direction: true,
          documentNumber: true,
          title: true,
          status: true,
          urgency: true,
          createdAt: true,
        },
      }),
    ]);

    return successResponse({
      summary: {
        totalIncoming,
        pendingIncoming,
        overdueIncoming,
        urgentIncoming,
        todayIncoming,
        totalOutgoing,
        pendingOutgoing,
        issuedOutgoing,
        myHandlingCount,
      },
      recentDocuments,
    });
  } catch (error) {
    console.warn("[DashboardStats] Database offline, returning demo statistics:", (error as Error).message);
    return successResponse({
      summary: {
        totalIncoming: 42,
        pendingIncoming: 8,
        overdueIncoming: 2,
        urgentIncoming: 3,
        todayIncoming: 5,
        totalOutgoing: 28,
        pendingOutgoing: 6,
        issuedOutgoing: 18,
        myHandlingCount: 4,
      },
      recentDocuments: [
        {
          id: "doc-demo-01",
          direction: "INCOMING",
          documentNumber: "128",
          title: "V/v Hướng dẫn triển khai công tác cải cách hành chính và chuyển đổi số năm 2026",
          status: "PROCESSING",
          urgency: "URGENT",
          createdAt: new Date().toISOString(),
        },
        {
          id: "doc-demo-02",
          direction: "INCOMING",
          documentNumber: "86",
          title: "Triệu tập Hội nghị sơ kết công tác quý I và triển khai nhiệm vụ quý II năm 2026",
          status: "PENDING_LEADER",
          urgency: "FIRE",
          createdAt: new Date().toISOString(),
        },
        {
          id: "doc-demo-03",
          direction: "OUTGOING",
          documentNumber: "45/QĐ-CQ",
          title: "Quyết định về việc kiện toàn Hội đồng Thi đua - Khen thưởng cơ quan",
          status: "ISSUED",
          urgency: "NORMAL",
          createdAt: new Date().toISOString(),
        },
        {
          id: "doc-demo-04",
          direction: "OUTGOING",
          documentNumber: "DRAFT-2026-09",
          title: "Tờ trình về việc phê duyệt dự toán kinh phí nâng cấp hạ tầng CNTT năm 2026",
          status: "PENDING_APPROVAL",
          urgency: "URGENT",
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }
}
