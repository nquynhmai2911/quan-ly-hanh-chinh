// src/app/(dashboard)/documents/incoming/page.tsx
// Màn hình Danh sách Văn bản đến: Phân trang Server-side, Tabs lọc trạng thái, Bút phê & Phân công nhanh

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  Badge,
  DocumentStatusBadge,
  UrgencyBadge,
  SecurityBadge,
} from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { FileText, Plus, UserCheck, Eye, Clock } from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { DocumentStatus } from "@prisma/client";

interface IncomingItem {
  id: string;
  documentNumber: string | null;
  originalCode: string | null;
  title: string;
  receivedDate: string;
  issuedDate: string | null;
  processingDeadline: string | null;
  status: DocumentStatus;
  urgency: "NORMAL" | "URGENT" | "FIRE";
  security: "NORMAL" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";
  senderName: string | null;
  senderOrg: { id: string; name: string; code: string } | null;
  documentBook: { id: string; name: string } | null;
  documentType: { id: string; name: string; code: string } | null;
  handlers: Array<{
    assignee: { id: string; fullName: string };
    status: string;
    deadline: string | null;
  }>;
  files: Array<{ id: string; fileName: string; fileSize: number }>;
}

const STATUS_TABS: Array<{ label: string; value: DocumentStatus | "" }> = [
  { label: "Tất cả", value: "" },
  { label: "Chờ tiếp nhận", value: "SUBMITTED" },
  { label: "Đã vào sổ", value: "RECEIVED" },
  { label: "Chờ xin ý kiến", value: "PENDING_LEADER" },
  { label: "Đã bút phê", value: "DISTRIBUTED" },
  { label: "Đang xử lý", value: "PROCESSING" },
  { label: "Chờ duyệt", value: "PENDING_REVIEW" },
  { label: "Hoàn thành", value: "COMPLETED" },
];

export default function IncomingDocumentsPage() {
  const router = useRouter();
  const [data, setData] = useState<IncomingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "">("");
  const [isLoading, setIsLoading] = useState(true);

  const [canCreate, setCanCreate] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.success)
          setCanCreate(
            j.data.roles.some((r: string) => ["ADMIN", "CLERK"].includes(r)),
          );
      });
  }, []);

  async function fetchIncomingDocs() {
    try {
      setIsLoading(true);
      const url = new URL("/api/documents/incoming", window.location.origin);
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
        toast.error(
          json.error?.message || "Không thể tải danh sách văn bản đến.",
        );
      }
    } catch {
      toast.error("Lỗi khi tải dữ liệu văn bản đến.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchIncomingDocs();
  }, [page, pageSize, search, statusFilter]);

  const columns: ColumnDef<IncomingItem, unknown>[] = [
    {
      accessorKey: "documentNumber",
      header: "Số đến",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
          {row.original.documentNumber || "Chưa có"}
        </span>
      ),
    },
    {
      accessorKey: "originalCode",
      header: "Ký hiệu gốc",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-700">
          {row.original.originalCode || "—"}
        </span>
      ),
    },
    {
      accessorKey: "senderName",
      header: "Nơi gửi",
      cell: ({ row }) => (
        <span className="text-xs text-slate-800 font-medium">
          {row.original.senderOrg?.name || row.original.senderName || "Nội bộ"}
        </span>
      ),
    },
    {
      accessorKey: "title",
      header: "Trích yếu nội dung",
      cell: ({ row }) => (
        <div className="max-w-md">
          <p className="font-semibold text-slate-900 line-clamp-2 hover:text-indigo-600 transition-colors">
            {row.original.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <UrgencyBadge level={row.original.urgency} />
            <SecurityBadge level={row.original.security} />
            {row.original.processingDeadline && (
              <span className="text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded">
                <Clock className="h-3 w-3" />
                Hạn:{" "}
                {new Date(row.original.processingDeadline).toLocaleDateString(
                  "vi-VN",
                )}
              </span>
            )}
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
      id: "handler",
      header: "Người chủ trì",
      cell: ({ row }) => {
        const main = row.original.handlers?.[0];
        if (!main)
          return (
            <span className="text-slate-400 italic text-xs">Chưa giao</span>
          );
        return (
          <div className="text-xs">
            <span className="font-medium text-slate-800">
              {main.assignee?.fullName || "Chưa phân công"}
            </span>
            <span className="text-[10px] text-slate-400 block uppercase">
              {main.status}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Thao tác",
      cell: ({ row }) => (
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Văn bản đến
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý tiếp nhận, vào sổ, trình bút phê và phân công xử lý văn bản
            đến
          </p>
        </div>
        {canCreate && (
          <Link href="/documents/incoming/new">
            <Button className="gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              Vào sổ văn bản đến mới
            </Button>
          </Link>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-1 text-xs select-none">
        {STATUS_TABS.map((tab) => {
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

      {/* Data Table */}
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
        searchPlaceholder="Tìm theo số đến, ký hiệu gốc, trích yếu, nơi gửi..."
      />
    </div>
  );
}
