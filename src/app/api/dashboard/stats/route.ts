// src/app/api/dashboard/stats/route.ts
// API Thống kê số liệu Dashboard điều hành (tự động lọc theo quyền và Data Scope)

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, buildDataScopeFilter } from "@/lib/auth/guard";
import {
  incomingActions,
  workflowInclude,
} from "@/modules/document/incoming/workflow";
import { incomingScope } from "@/modules/document/incoming/access";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const ctx = await requireAuth();

    const incomingFilter = incomingScope(ctx);

    const outgoingFilter = await buildDataScopeFilter(
      ctx,
      Permissions.OUTGOING_VIEW,
      {
        creatorField: "creatorId",
        unitField: "draftUnitId",
      },
    );

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

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
      myHandlingDocs,
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
      prisma.documentHandler.findMany({
        where: {
          assigneeId: ctx.userId,
          status: { in: ["ASSIGNED", "PROCESSING", "RETURNED"] },
          role: { not: "INFO" },
          document: { status: "PROCESSING" },
        },
      }),
      // 5 văn bản mới nhất
      prisma.document.findMany({
        where: {
          OR: [
            incomingScope(ctx),
            { direction: "OUTGOING", ...outgoingFilter },
          ],
        },
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

    const queued = await prisma.document.findMany({
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
    });
    const myHandlingCount = new Set([
      ...myHandlingDocs.map((h) => h.documentId),
      ...queued
        .filter((d) => incomingActions(ctx, d).length > 0)
        .map((d) => d.id),
    ]).size;

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
    return errorResponse(error);
  }
}
