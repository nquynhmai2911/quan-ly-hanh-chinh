// src/app/(dashboard)/admin/audit-logs/page.tsx
// Màn hình Tra cứu Nhật ký hoạt động hệ thống (Audit Trail) dành cho Quản trị viên

"use client";

import { actionLabel } from "@/lib/display-labels";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Filter,
  History,
  Lock,
} from "lucide-react";

interface AuditLog {
  id: string;
  createdAt: string;
  action: string;
  tableName: string;
  recordId: string | null;
  reason: string | null;
  description: string | null;
  ipAddress: string | null;
  actor?: { fullName: string; employeeCode: string } | null;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadLogs(resetPage = true) {
    try {
      setIsLoading(true);
      const targetPage = resetPage ? 1 : page;
      if (resetPage) setPage(1);

      const params = new URLSearchParams({
        page: targetPage.toString(),
        pageSize: pageSize.toString(),
      });
      if (search) params.set("search", search);
      if (action) params.set("action", action);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.items || json.data || []);
        setTotal(json.data.total || 0);
      }
    } catch {
      toast.error("Không thể tải nhật ký hoạt động.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLogs(false);
  }, [page]);

  function getActionBadge(actionName: string) {
    if (actionName.includes("ISSUE") || actionName.includes("APPROVE")) {
      return <Badge variant="success">{actionLabel(actionName)}</Badge>;
    }
    if (actionName.includes("ASSIGN") || actionName.includes("ANNOTATE")) {
      return <Badge variant="info">{actionLabel(actionName)}</Badge>;
    }
    if (actionName.includes("RECALL") || actionName.includes("CANCEL")) {
      return <Badge variant="danger">{actionLabel(actionName)}</Badge>;
    }
    return <Badge variant="default">{actionLabel(actionName)}</Badge>;
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="h-6 w-6 text-indigo-600" />
            Nhật ký hoạt động và kiểm toán
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Lịch sử toàn vẹn của mọi hành động trên hệ thống (Chỉ ghi bổ sung,
            không chỉnh sửa hoặc xóa)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Bất biến & Mã hóa
          </span>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white rounded border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadLogs(true)}
              placeholder="Tìm theo nội dung mô tả, mã bản ghi..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            >
              <option value="">Tất cả loại hành động</option>
              <option value="DOC_CREATE_INCOMING">Vào sổ tiếp nhận</option>
              <option value="DOC_LEADER_ANNOTATE">Ghi bút phê lãnh đạo</option>
              <option value="DOC_ASSIGN_HANDLERS">Phân công chuyên viên</option>
              <option value="DOC_LEADER_APPROVE">Phê duyệt điện tử</option>
              <option value="DOC_ISSUE">Ban hành văn bản</option>
              <option value="DOC_RECALL">Thu hồi văn bản</option>
              <option value="DOC_CANCEL">Hủy hiệu lực văn bản</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setAction("");
              loadLogs(true);
            }}
          >
            Đặt lại
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => loadLogs(true)}
            isLoading={isLoading}
            className="gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" /> Lọc nhật ký
          </Button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            DANH SÁCH BẢN GHI KIỂM TOÁN ({total} bản ghi)
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-10 bg-slate-100 rounded animate-pulse"
              />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Không có bản ghi nhật ký nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Thời gian</th>
                  <th className="px-4 py-3 whitespace-nowrap">
                    Người thực hiện
                  </th>
                  <th className="px-4 py-3 whitespace-nowrap">Hành động</th>
                  <th className="px-4 py-3 whitespace-nowrap">
                    Bảng / Đối tượng
                  </th>
                  <th className="px-4 py-3">Nội dung chi tiết</th>
                  <th className="px-4 py-3 whitespace-nowrap">Địa chỉ IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleDateString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        {log.actor?.fullName || "Hệ thống"}
                      </div>
                      {log.actor?.employeeCode && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          {log.actor.employeeCode}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      {(
                        {
                          documents: "Văn bản",
                          users: "Người dùng",
                          document_files: "Tệp đính kèm",
                          units: "Phòng ban",
                        } as Record<string, string>
                      )[log.tableName] || "Hồ sơ hệ thống"}{" "}
                      <span className="text-slate-400">
                        ({log.recordId?.slice(0, 8)}...)
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {log.reason || log.description || actionLabel(log.action)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-400">
                      {log.ipAddress || "127.0.0.1"}
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
