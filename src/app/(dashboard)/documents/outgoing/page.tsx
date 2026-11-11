// src/app/(dashboard)/documents/outgoing/page.tsx
// Màn hình Danh sách Văn bản đi / Tờ trình: Phân trang Server-side, Tabs trạng thái, Chi tiết chuỗi duyệt

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge, DocumentStatusBadge, UrgencyBadge, SecurityBadge } from "@/components/ui/badge";
import { Send, Plus, Eye, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { DocumentStatus } from "@prisma/client";

interface OutgoingItem {
  id: string;
  documentNumber: string | null;
  title: string;
  status: DocumentStatus;
  urgency: "NORMAL" | "URGENT" | "FIRE";
  security: "NORMAL" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";
  issuedDate: string | null;
  signerName: string | null;
  signerPosition: string | null;
  draftUnit: { id: string; name: string; code: string } | null;
  documentType: { id: string; name: string; code: string } | null;
  creator: { id: string; fullName: string };
  approvals: Array<{
    stepOrder: number;
    role: string;
    status: string;
    approver: { fullName: string };
  }>;
  files: Array<{ id: string; fileName: string; version: number }>;
  createdAt: string;
}

const OUTGOING_STATUS_TABS: Array<{ label: string; value: DocumentStatus | "" }> = [
  { label: "Tất cả", value: "" },
  { label: "Dự thảo", value: "DRAFT" },
  { label: "Chờ duyệt sơ bộ", value: "PENDING_REVIEW" },
  { label: "Chờ ký duyệt", value: "PENDING_APPROVAL" },
  { label: "Đã ký duyệt", value: "APPROVED" },
  { label: "Đã cấp số", value: "NUMBERED" },
  { label: "Đã ban hành", value: "ISSUED" },
  { label: "Bị trả lại", value: "RETURNED" },
];

export default function OutgoingDocumentsPage() {
  const router = useRouter();
  const [data, setData] = useState<OutgoingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);

  async function fetchOutgoingDocs() {
    try {
      setIsLoading(true);
      const url = new URL("/api/documents/outgoing", window.location.origin);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(pageSize));
      if (search) url.searchParams.set("search", search);
      if (statusFilter) url.searchParams.set("status", statusFilter);

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setTotal(json.pagination?.total || 0);
      } else {
        toast.error(json.error?.message || "Không thể tải danh sách văn bản đi.");
      }
    } catch {
      toast.error("Lỗi khi tải dữ liệu văn bản đi.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchOutgoingDocs();
  }, [page, pageSize, search, statusFilter]);

  const columns: ColumnDef<OutgoingItem, any>[] = [
    {
      accessorKey: "documentNumber",
      header: "Số / Ký hiệu",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          {row.original.documentNumber || <span className="text-slate-400 italic">Dự thảo</span>}
        </span>
      ),
    },
    {
      id: "unit",
      header: "Đơn vị soạn thảo",
      cell: ({ row }) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.original.draftUnit?.name || "—"} ({row.original.draftUnit?.code})
        </span>
      ),
    },
    {
      accessorKey: "title",
      header: "Trích yếu dự thảo",
      cell: ({ row }) => (
        <div className="max-w-md">
          <p className="font-semibold text-slate-900 line-clamp-2 hover:text-indigo-600 transition-colors">
            {row.original.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-slate-400 font-mono">
              Tạo bởi: {row.original.creator?.fullName || "Chuyên viên"}
            </span>
            <UrgencyBadge level={row.original.urgency} />
            <SecurityBadge level={row.original.security} />
          </div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Trạng thái",
      cell: ({ row }) => <DocumentStatusBadge status={row.original.status} />,
    },
    {
      id: "approvals",
      header: "Tiến độ duyệt",
      cell: ({ row }) => {
        const apps = row.original.approvals || [];
        if (apps.length === 0) return <span className="text-slate-400 italic text-xs">Chưa tạo chuỗi</span>;
        return (
          <div className="flex items-center gap-1">
            {apps.map((a, i) => (
              <span
                key={i}
                title={`${a.role}: ${a.approver?.fullName || "Cán bộ"} (${a.status})`}
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                  a.status === "APPROVED"
                    ? "bg-emerald-100 text-emerald-800"
                    : a.status === "REJECTED"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                B{a.stepOrder}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "signerName",
      header: "Người ký",
      cell: ({ row }) => (
        <div className="text-xs">
          <span className="font-medium text-slate-800">{row.original.signerName || "Chưa chọn"}</span>
          {row.original.signerPosition && (
            <span className="text-[10px] text-slate-400 block">{row.original.signerPosition}</span>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: "Thao tác",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => router.push(`/documents/${row.original.id}`)}
          >
            <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" />
            Chi tiết
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Văn bản đi & Tờ trình</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý quy trình soạn thảo dự thảo, phê duyệt nối tiếp, cấp số và ban hành văn bản
          </p>
        </div>
        <Link href="/documents/outgoing/new">
          <Button className="gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            Tạo dự thảo văn bản đi mới
          </Button>
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-1 text-xs select-none">
        {OUTGOING_STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-t font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-white text-indigo-600 border border-b-white border-slate-200 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        isLoading={isLoading}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onSearchChange={setSearch}
        onRowClick={(row) => router.push(`/documents/${row.id}`)}
        searchPlaceholder="Tìm theo số ký hiệu, trích yếu, người ký..."
      />
    </div>
  );
}
