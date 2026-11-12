// src/app/(dashboard)/reports/page.tsx
// Màn hình Báo cáo Thống kê chuyên sâu & Xuất Sổ đăng ký văn bản hành chính

"use client";

import { documentStatusLabels } from "@/lib/display-labels";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Building2,
  FileCheck,
  Clock,
  Inbox,
  Send,
  PieChart,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

type MonthStat = { month: string; incoming: number; outgoing: number };
type DeptStat = { unitName: string; code: string; total: number; onTimeRate: number };
type DocTypeStat = { typeName: string; count: number; percent: number };
type IncomingSample = { id: string; documentNumber: string; receivedDate: string | null; senderOrg?: { name: string } | null; senderName: string; originalCode: string | null; title: string; documentType?: { name: string } | null; urgency: string; handlers: Array<{ assignee?: { fullName: string } | null }>; processingDeadline: string | null; status: string };
type OutgoingSample = { id: string; documentNumber: string | null; issuedDate: string | null; createdAt: string; draftUnit?: { name: string } | null; title: string; documentType?: { name: string } | null; urgency: string; signerName: string | null; recipientsSummary: string | null; status: string };
interface ReportData {
  summary: { avgOnTimeRate: number; totalCompleted: number; totalIncoming: number; totalOutgoing: number; totalOverdue: number };
  monthlyStats: MonthStat[];
  deptStats: DeptStat[];
  docTypeStats: DocTypeStat[];
  sampleIncoming: IncomingSample[];
  sampleOutgoing: OutgoingSample[];
}

export default function ReportsPage() {
  const [selectedYear, setSelectedYear] = useState(
    String(new Date().getFullYear()),
  );
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadReport(year = selectedYear) {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/reports?year=${year}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch {
      toast.error("Không thể tải số liệu báo cáo.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReport(selectedYear);
  }, [selectedYear]);

  function exportBook(bookType: "INCOMING" | "OUTGOING") {
    window.open(
      `/api/reports/export-excel?bookType=${bookType}&year=${selectedYear}`,
      "_blank",
    );
    toast.success(
      `Đang xuất Sổ văn bản ${bookType === "INCOMING" ? "đến" : "đi"} năm ${selectedYear}...`,
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-indigo-600" />
            Báo cáo Thống kê & Sổ Văn bản Hành chính
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tổng hợp dữ liệu luân chuyển, tỷ lệ xử lý đúng hạn và xuất/in sổ
            đăng ký văn bản theo Nghị định 30/2020/NĐ-CP
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
          >
            <option value="2026">Năm 2026</option>
            <option value="2025">Năm 2025</option>
            <option value="2024">Năm 2024</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportBook("INCOMING")}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Xuất Sổ VB Đến
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportBook("OUTGOING")}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Xuất Sổ VB Đi
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" /> In Báo cáo
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Tổng VB Đến
            </span>
            <Inbox className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {data?.summary?.totalIncoming || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Đã vào sổ tiếp nhận</p>
        </div>

        <div className="bg-white rounded border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Tổng VB Đi
            </span>
            <Send className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {data?.summary?.totalOutgoing || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Đã soạn & ban hành</p>
        </div>

        <div className="bg-white rounded border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Đã hoàn thành
            </span>
            <CheckCircle2 className="h-4 w-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {data?.summary?.totalCompleted || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Đạt kết quả nghiệm thu
          </p>
        </div>

        <div className="bg-white rounded border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Tỷ lệ đúng hạn
            </span>
            <FileCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {data?.summary?.avgOnTimeRate || 95}%
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Chỉ tiêu cơ quan: ≥ 90%
          </p>
        </div>

        <div className="bg-white rounded border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Văn bản quá hạn
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2">
            {data?.summary?.totalOverdue || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Cần đôn đốc xử lý gấp
          </p>
        </div>
      </div>

      {/* Biểu đồ tháng */}
      <div className="bg-white rounded border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-indigo-600" /> Biểu đồ số lượng
            văn bản luân chuyển 12 tháng năm {selectedYear}
          </span>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-3 w-3 rounded-xs bg-indigo-600 inline-block" />{" "}
              VB Đến
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-3 w-3 rounded-xs bg-emerald-500 inline-block" />{" "}
              VB Đi
            </span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2 h-48 items-end pt-4 pb-2 border-b border-slate-200">
          {(data?.monthlyStats || []).map((m: MonthStat, idx: number) => {
            const maxVal = 100;
            const incHeight = Math.min(
              100,
              Math.round((m.incoming / maxVal) * 100),
            );
            const outHeight = Math.min(
              100,
              Math.round((m.outgoing / maxVal) * 100),
            );

            return (
              <div
                key={idx}
                className="flex flex-col items-center h-full justify-end group"
              >
                <div className="w-full flex items-end justify-center gap-1 h-36">
                  {/* Incoming bar */}
                  <div
                    className="w-1/2 bg-indigo-600 rounded-t transition-all hover:bg-indigo-700 relative group/bar"
                    style={{ height: `${incHeight}%` }}
                  >
                    <span className="opacity-0 group-hover/bar:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                      Đến: {m.incoming}
                    </span>
                  </div>

                  {/* Outgoing bar */}
                  <div
                    className="w-1/2 bg-emerald-500 rounded-t transition-all hover:bg-emerald-600 relative group/bar"
                    style={{ height: `${outHeight}%` }}
                  >
                    <span className="opacity-0 group-hover/bar:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                      Đi: {m.outgoing}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 mt-2">
                  {m.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Thống kê phòng ban & Cơ cấu loại văn bản */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Bảng theo phòng ban */}
        <div className="lg:col-span-2 bg-white rounded border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-indigo-600" /> Kết quả xử lý
              theo đơn vị / phòng ban
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Đơn vị / Phòng ban</th>
                  <th className="px-3 py-2.5 text-center">Tổng nhiệm vụ</th>
                  <th className="px-3 py-2.5">Tỷ lệ đúng hạn</th>
                  <th className="px-3 py-2.5 text-right">Đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.deptStats || []).map((dept: DeptStat, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {dept.unitName} ({dept.code})
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                      {dept.total}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-28 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              dept.onTimeRate >= 95
                                ? "bg-emerald-500"
                                : dept.onTimeRate >= 90
                                  ? "bg-indigo-600"
                                  : "bg-amber-500"
                            }`}
                            style={{ width: `${dept.onTimeRate}%` }}
                          />
                        </div>
                        <span className="font-bold text-[11px] text-slate-700">
                          {dept.onTimeRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          dept.onTimeRate >= 95
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}
                      >
                        {dept.onTimeRate >= 95 ? "Xuất sắc" : "Tốt"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cơ cấu loại văn bản */}
        <div className="bg-white rounded border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
              <PieChart className="h-4 w-4 text-indigo-600" /> Cơ cấu loại văn
              bản
            </span>
          </div>

          <div className="space-y-3">
            {(data?.docTypeStats || []).map((dt: DocTypeStat, i: number) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    {dt.typeName}
                  </span>
                  <span className="text-slate-500">
                    <strong className="text-slate-900">{dt.count}</strong> (
                    {dt.percent}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full"
                    style={{ width: `${dt.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs text-slate-500 mt-4">
            <p>
              * Số liệu trên được tổng hợp từ toàn bộ các sổ văn bản cơ quan đã
              đăng ký và ban hành trong năm {selectedYear}.
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════ */}
      {/* SỔ ĐĂNG KÝ VĂN BẢN MẪU: 5 VĂN BẢN ĐẾN & 5 VĂN BẢN ĐI (KHỚP PHÂN HỆ LUÂN CHUYỂN) */}
      {/* ══════════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-indigo-600" />
              Sổ Đăng Ký Văn Bản Hành Chính (Mẫu 5 Văn Bản Đến & 5 Văn Bản Đi)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dữ liệu đối chiếu đồng bộ thời gian thực với phân hệ Văn bản đến
              và Văn bản đi theo Nghị định 30/2020/NĐ-CP
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
              Tổng mẫu: 10 văn bản
            </span>
          </div>
        </div>

        {/* 1. BẢNG 5 VĂN BẢN ĐẾN */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
              <Inbox className="h-4 w-4 text-indigo-600" />
              1. Sổ Đăng ký Văn bản Đến (5 văn bản tiếp nhận)
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportBook("INCOMING")}
              className="h-7 text-xs gap-1"
            >
              <Download className="h-3 w-3" /> Xuất Excel Sổ VB Đến
            </Button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 w-12 text-center">STT</th>
                  <th className="px-3 py-2.5 w-20">Số đến</th>
                  <th className="px-3 py-2.5 w-24">Ngày đến</th>
                  <th className="px-3 py-2.5 w-36">Cơ quan gửi</th>
                  <th className="px-3 py-2.5 w-32">Ký hiệu gốc</th>
                  <th className="px-3 py-2.5">Trích yếu nội dung</th>
                  <th className="px-3 py-2.5 w-36">Chủ trì xử lý</th>
                  <th className="px-3 py-2.5 w-24">Hạn xử lý</th>
                  <th className="px-3 py-2.5 w-28 text-center">Trạng thái</th>
                  <th className="px-3 py-2.5 w-24 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.sampleIncoming || []).map((doc: IncomingSample, idx: number) => {
                  const handlerName =
                    doc.handlers?.[0]?.assignee?.fullName || "Chưa phân công";
                  const deadlineStr = doc.processingDeadline
                    ? new Date(doc.processingDeadline).toLocaleDateString(
                        "vi-VN",
                      )
                    : "—";

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-indigo-50/40 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-center font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                          {doc.documentNumber}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {doc.receivedDate
                          ? new Date(doc.receivedDate).toLocaleDateString(
                              "vi-VN",
                            )
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {doc.senderOrg?.name || doc.senderName}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">
                        {doc.originalCode || "—"}
                      </td>
                      <td className="px-3 py-2.5 max-w-sm">
                        <p className="font-semibold text-slate-900 line-clamp-1">
                          {doc.title}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-0.5 inline-block">
                          Loại: {doc.documentType?.name || "Chưa ghi nhận"} •{" "}
                          {doc.urgency === "FIRE"
                            ? "Hỏa tốc"
                            : doc.urgency === "URGENT"
                              ? "Khẩn"
                              : "Thường"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-800">
                        <span className="font-medium">{handlerName}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {deadlineStr}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${
                            doc.status === "COMPLETED"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : doc.status === "PROCESSING"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : doc.status === "DISTRIBUTED"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
                          }`}
                        >
                          {documentStatusLabels[doc.status] || "Chưa ghi nhận"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <a
                          href={`/documents/${doc.id}`}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          Chi tiết &rarr;
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. BẢNG 5 VĂN BẢN ĐI */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
              <Send className="h-4 w-4 text-emerald-600" />
              2. Sổ Đăng ký Văn bản Đi & Dự thảo (5 văn bản phát hành)
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportBook("OUTGOING")}
              className="h-7 text-xs gap-1"
            >
              <Download className="h-3 w-3" /> Xuất Excel Sổ VB Đi
            </Button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5 w-12 text-center">STT</th>
                  <th className="px-3 py-2.5 w-28">Số / Ký hiệu</th>
                  <th className="px-3 py-2.5 w-24">Ngày tháng</th>
                  <th className="px-3 py-2.5 w-36">Đơn vị soạn</th>
                  <th className="px-3 py-2.5">Tên loại & Trích yếu nội dung</th>
                  <th className="px-3 py-2.5 w-32">Người ký / Tạo</th>
                  <th className="px-3 py-2.5 w-36">Nơi nhận</th>
                  <th className="px-3 py-2.5 w-28 text-center">Trạng thái</th>
                  <th className="px-3 py-2.5 w-24 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.sampleOutgoing || []).map((doc: OutgoingSample, idx: number) => {
                  const dateStr = doc.issuedDate
                    ? new Date(doc.issuedDate).toLocaleDateString("vi-VN")
                    : doc.createdAt
                      ? new Date(doc.createdAt).toLocaleDateString("vi-VN")
                      : "—";

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-emerald-50/40 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-center font-bold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-[11px]">
                          {doc.documentNumber || "Dự thảo"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{dateStr}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">
                        {doc.draftUnit?.name || "Chưa ghi nhận"}
                      </td>
                      <td className="px-3 py-2.5 max-w-sm">
                        <p className="font-semibold text-slate-900 line-clamp-1">
                          {doc.title}
                        </p>
                        <span className="text-[10px] text-slate-400 mt-0.5 inline-block">
                          Loại: {doc.documentType?.name || "Văn bản"} •{" "}
                          {doc.urgency === "FIRE"
                            ? "Hỏa tốc"
                            : doc.urgency === "URGENT"
                              ? "Khẩn"
                              : "Thường"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-800">
                        <span className="font-medium">
                          {doc.signerName || "Chưa phê duyệt"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 truncate max-w-xs">
                        {doc.recipientsSummary || "Chưa ghi nhận"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block ${
                            doc.status === "ISSUED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : doc.status === "NUMBERED"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : doc.status === "PENDING_APPROVAL"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
                          }`}
                        >
                          {documentStatusLabels[doc.status] || "Chưa ghi nhận"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <a
                          href={`/documents/${doc.id}`}
                          className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 hover:underline"
                        >
                          Chi tiết &rarr;
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
