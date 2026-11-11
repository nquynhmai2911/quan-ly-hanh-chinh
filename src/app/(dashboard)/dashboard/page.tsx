// src/app/(dashboard)/dashboard/page.tsx
// Màn hình Dashboard Tổng quan & Điều hành hành chính

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentStatusBadge, UrgencyBadge } from "@/components/ui/badge";
import {
  FileText,
  Send,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Flame,
  UserCheck,
  TrendingUp,
  Download,
  Plus,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface DashboardData {
  summary: {
    totalIncoming: number;
    pendingIncoming: number;
    overdueIncoming: number;
    urgentIncoming: number;
    todayIncoming: number;
    totalOutgoing: number;
    pendingOutgoing: number;
    issuedOutgoing: number;
    myHandlingCount: number;
  };
  recentDocuments: Array<{
    id: string;
    direction: "INCOMING" | "OUTGOING";
    documentNumber: string | null;
    title: string;
    status: any;
    urgency: any;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setData(j.data);
        } else {
          toast.error("Không thể tải số liệu thống kê.");
        }
      })
      .catch(() => toast.error("Lỗi kết nối máy chủ."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Trung tâm Điều hành E-Office</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng quan lưu lượng văn bản, tiến độ xử lý và cảnh báo quá hạn theo thời gian thực
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/reports/export-excel" download>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              Xuất sổ Excel
            </Button>
          </a>
          <Link href="/documents/incoming/new">
            <Button size="sm" className="gap-1.5 text-xs shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              Tiếp nhận văn bản
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Việc cá nhân */}
        <div className="bg-white rounded border border-slate-200 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">VIỆC TÔI PHẢI XỬ LÝ</span>
            <div className="p-2 rounded bg-indigo-50 text-indigo-600">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-700">
              {isLoading ? "..." : data?.summary.myHandlingCount || 0}
            </span>
            <span className="text-xs text-slate-400">hồ sơ cần thụ lý</span>
          </div>
          <Link
            href="/documents/incoming"
            className="text-[11px] text-indigo-600 font-medium hover:underline mt-3 inline-flex items-center gap-1"
          >
            Vào danh sách xử lý <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Văn bản đến chờ duyệt */}
        <div className="bg-white rounded border border-slate-200 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">VB ĐẾN ĐANG XỬ LÝ</span>
            <div className="p-2 rounded bg-amber-50 text-amber-600">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-700">
              {isLoading ? "..." : data?.summary.pendingIncoming || 0}
            </span>
            <span className="text-xs text-slate-400">/ tổng {data?.summary.totalIncoming || 0}</span>
          </div>
          <Link
            href="/documents/incoming"
            className="text-[11px] text-amber-600 font-medium hover:underline mt-3 inline-flex items-center gap-1"
          >
            Theo dõi tiến độ <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Cảnh báo quá hạn */}
        <div className="bg-white rounded border border-slate-200 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">CẢNH BÁO QUÁ HẠN</span>
            <div className="p-2 rounded bg-rose-50 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600">
              {isLoading ? "..." : data?.summary.overdueIncoming || 0}
            </span>
            <span className="text-xs text-slate-400">văn bản trễ tiến độ</span>
          </div>
          <div className="text-[11px] text-rose-500 font-medium mt-3 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Cần đôn đốc khẩn cấp
          </div>
        </div>

        {/* Văn bản đi đã ban hành */}
        <div className="bg-white rounded border border-slate-200 p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">VB ĐI ĐÃ BAN HÀNH</span>
            <div className="p-2 rounded bg-emerald-50 text-emerald-600">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">
              {isLoading ? "..." : data?.summary.issuedOutgoing || 0}
            </span>
            <span className="text-xs text-slate-400">/ tổng {data?.summary.totalOutgoing || 0}</span>
          </div>
          <Link
            href="/documents/outgoing"
            className="text-[11px] text-emerald-600 font-medium hover:underline mt-3 inline-flex items-center gap-1"
          >
            Xem sổ văn bản đi <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Danh sách văn bản mới luân chuyển gần đây */}
      <div className="bg-white rounded border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            Văn bản luân chuyển gần đây nhất
          </h2>
          <Link href="/documents/incoming" className="text-xs text-indigo-600 hover:underline">
            Xem tất cả
          </Link>
        </div>

        {isLoading ? (
          <p className="text-xs text-slate-400 text-center py-6">Đang tải dữ liệu...</p>
        ) : data?.recentDocuments.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Chưa có văn bản nào trong hệ thống.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data?.recentDocuments.map((doc) => (
              <div
                key={doc.id}
                onClick={() => (window.location.href = `/documents/${doc.id}`)}
                className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50 px-2 rounded cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded shrink-0 ${
                      doc.direction === "INCOMING" ? "bg-sky-50 text-sky-600" : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    {doc.direction === "INCOMING" ? <FileText className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {doc.documentNumber || "Chưa cấp số"}
                    </span>
                    <p className="text-xs font-medium text-slate-900 line-clamp-1 mt-0.5">{doc.title}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <UrgencyBadge level={doc.urgency} />
                  <DocumentStatusBadge status={doc.status} />
                  <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                    {new Date(doc.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
