// src/app/(dashboard)/search/page.tsx
// Màn hình Tra cứu Văn bản đa tiêu chí tập trung (Hỗ trợ tiếng Việt không dấu, xuất Excel)

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge, DocumentStatusBadge, UrgencyBadge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Download,
  RotateCcw,
  FileText,
  Calendar,
  Building2,
  ArrowRight,
  Eye,
  Inbox,
  Send,
} from "lucide-react";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");
  const [urgency, setUrgency] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSearch(resetPage = true) {
    try {
      setIsLoading(true);
      const targetPage = resetPage ? 1 : page;
      if (resetPage) setPage(1);

      const params = new URLSearchParams({
        page: targetPage.toString(),
        pageSize: pageSize.toString(),
      });

      if (q) params.set("q", q);
      if (direction) params.set("direction", direction);
      if (status) params.set("status", status);
      if (urgency) params.set("urgency", urgency);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);

      const res = await fetch(`/api/search?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setResults(json.data.items || json.data || []);
        setTotal(json.data.total || 0);
      }
    } catch {
      toast.error("Lỗi khi tra cứu văn bản.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    handleSearch(false);
  }, [page]);

  function handleReset() {
    setQ("");
    setDirection("");
    setStatus("");
    setUrgency("");
    setFromDate("");
    setToDate("");
    setTimeout(() => {
      fetch("/api/search")
        .then((r) => r.json())
        .then((j) => {
          if (j.success) {
            setResults(j.data.items || j.data || []);
            setTotal(j.data.total || 0);
          }
        });
    }, 50);
  }

  function handleExportExcel() {
    window.open(`/api/reports/export-excel?bookType=${direction || "INCOMING"}&year=2026`, "_blank");
    toast.success("Đang tạo và xuất tệp Excel...");
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Search className="h-6 w-6 text-indigo-600" />
            Tra cứu Văn bản tập trung
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tìm kiếm nhanh chóng văn bản đến và văn bản đi theo nhiều tiêu chí, trích yếu, số hiệu và thời gian
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
            <Download className="h-4 w-4" /> Xuất kết quả Excel
          </Button>
        </div>
      </div>

      {/* Form bộ lọc nâng cao */}
      <div className="bg-white rounded border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase">
            <Filter className="h-4 w-4 text-indigo-600" /> Bộ lọc tra cứu đa tiêu chí
          </span>
          <button
            onClick={handleReset}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Đặt lại mặc định
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Từ khóa tìm kiếm (Số/ký hiệu, Trích yếu, Cơ quan gửi/nhận)
            </label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch(true)}
                placeholder="Nhập nội dung cần tìm... (hỗ trợ tiếng Việt không dấu)"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Loại luồng văn bản</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            >
              <option value="">Tất cả (Đến & Đi)</option>
              <option value="INCOMING">Văn bản đến</option>
              <option value="OUTGOING">Văn bản đi / Dự thảo</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Trạng thái xử lý</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="RECEIVED">Mới tiếp nhận (RECEIVED)</option>
              <option value="PENDING_LEADER">Chờ lãnh đạo cho ý kiến</option>
              <option value="PROCESSING">Đang xử lý (PROCESSING)</option>
              <option value="PENDING_APPROVAL">Chờ phê duyệt</option>
              <option value="ISSUED">Đã ban hành (ISSUED)</option>
              <option value="COMPLETED">Đã hoàn thành</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Độ khẩn</label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            >
              <option value="">Tất cả độ khẩn</option>
              <option value="NORMAL">Bình thường</option>
              <option value="URGENT">Khẩn</option>
              <option value="FIRE">Hỏa tốc</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Từ ngày</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Đến ngày</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={() => handleSearch(true)} isLoading={isLoading} className="gap-2 px-6">
            <Search className="h-4 w-4" /> Bắt đầu tìm kiếm
          </Button>
        </div>
      </div>

      {/* Kết quả tìm kiếm */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            KẾT QUẢ TÌM KIẾM ({total} văn bản phù hợp)
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Không tìm thấy văn bản phù hợp</p>
            <p className="text-xs text-slate-400">Hãy thử thay đổi từ khóa hoặc mở rộng khoảng thời gian tìm kiếm.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Luồng</th>
                  <th className="px-4 py-3">Số / Ký hiệu</th>
                  <th className="px-4 py-3">Trích yếu nội dung</th>
                  <th className="px-4 py-3">Cơ quan / Đơn vị</th>
                  <th className="px-4 py-3">Ngày văn bản</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      {doc.direction === "INCOMING" || doc.documentType === "INCOMING" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          <Inbox className="h-3 w-3" /> Đến
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <Send className="h-3 w-3" /> Đi
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                      {doc.documentNumber || doc.originalCode || "—"}
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600 line-clamp-2 transition-colors"
                      >
                        {doc.title}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <UrgencyBadge level={doc.urgency} />
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {doc.senderOrg?.name || doc.senderName || doc.draftUnit?.name || "Cơ quan hành chính"}
                    </td>

                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(doc.receivedDate || doc.issuedDate || doc.createdAt).toLocaleDateString("vi-VN")}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <DocumentStatusBadge status={doc.status} />
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/documents/${doc.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                          <Eye className="h-3 w-3" /> Chi tiết
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
