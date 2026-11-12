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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DocumentEditDrawer, EditableDocument } from "@/components/documents/document-edit-drawer";
import { FileText, Plus, UserCheck, Eye, Clock, Pencil, Trash2 } from "lucide-react";
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

  const [canView, setCanView] = useState<boolean | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [isCitizen, setIsCitizen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<EditableDocument | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<IncomingItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const roles = j.data.roles || [];
          const permissions = j.data.permissions || {};
          const isAdmin = roles.includes("ADMIN");
          const citizen =
            roles.includes("CITIZEN") &&
            !roles.some((r: string) =>
              [
                "ADMIN",
                "LEADER",
                "SPECIALIST",
              ].includes(r),
            );
          setIsCitizen(citizen);

          const hasViewPerm =
            isAdmin ||
            citizen ||
            Boolean(permissions["doc.incoming.view"]) ||
            Boolean(permissions["doc.incoming.create"]);
          setCanView(hasViewPerm);

          const hasCreatePerm =
            isAdmin ||
            Boolean(permissions["doc.incoming.create"]) ||
            Boolean(permissions["doc.incoming.register"]);
          setCanCreate(hasCreatePerm);
        } else {
          setCanView(false);
        }
      })
      .catch(() => setCanView(false));
  }, []);

  async function handleDeleteDocument() {
    if (!deletingDoc) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/documents/${deletingDoc.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error?.message || "Không thể xóa văn bản.");
      toast.success("Đã xóa văn bản thành công.");
      setDeletingDoc(null);
      fetchIncomingDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi khi xóa văn bản.");
    } finally {
      setIsDeleting(false);
    }
  }

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
      header: () => <span className="whitespace-nowrap">Số đến</span>,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded whitespace-nowrap inline-flex items-center">
          {row.original.documentNumber || "Chưa có"}
        </span>
      ),
    },
    {
      accessorKey: "originalCode",
      header: () => <span className="whitespace-nowrap">Ký hiệu gốc</span>,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-700 whitespace-nowrap">
          {row.original.originalCode || "—"}
        </span>
      ),
    },
    {
      accessorKey: "senderName",
      header: () => <span className="whitespace-nowrap">Nơi gửi</span>,
      cell: ({ row }) => (
        <span className="text-xs text-slate-800 font-medium whitespace-nowrap">
          {row.original.senderOrg?.name || row.original.senderName || "Nội bộ"}
        </span>
      ),
    },
    {
      accessorKey: "title",
      header: () => <span className="whitespace-nowrap">Trích yếu nội dung</span>,
      cell: ({ row }) => (
        <div className="min-w-[240px] max-w-lg">
          <p className="font-semibold text-slate-900 line-clamp-2 hover:text-indigo-600 transition-colors">
            {row.original.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <UrgencyBadge level={row.original.urgency} />
            <SecurityBadge level={row.original.security} />
            {row.original.processingDeadline && (
              <span className="text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                <Clock className="h-3 w-3 shrink-0" />
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
      header: () => <span className="whitespace-nowrap">Trạng thái</span>,
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <DocumentStatusBadge status={row.original.status} />
        </div>
      ),
    },
    {
      id: "handler",
      header: () => <span className="whitespace-nowrap">Người chủ trì</span>,
      cell: ({ row }) => {
        const main = row.original.handlers?.[0];
        if (!main)
          return (
            <span className="text-slate-400 italic text-xs whitespace-nowrap">Chưa giao</span>
          );
        return (
          <div className="text-xs whitespace-nowrap">
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
      header: () => <span className="whitespace-nowrap text-right block pr-2">Thao tác</span>,
      cell: ({ row }) => (
        <div
          className="flex items-center justify-end gap-1 whitespace-nowrap pr-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs whitespace-nowrap shrink-0 px-2"
            onClick={() => router.push(`/documents/${row.original.id}`)}
            title="Xem chi tiết"
          >
            <Eye className="h-3.5 w-3.5 mr-1 text-slate-500 shrink-0" />
            Chi tiết
          </Button>
          {!isCitizen && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs whitespace-nowrap shrink-0 px-2 text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                onClick={() =>
                  setEditingDoc({
                    id: row.original.id,
                    direction: "INCOMING",
                    title: row.original.title,
                    documentNumber: row.original.documentNumber,
                    originalCode: row.original.originalCode,
                    senderName:
                      row.original.senderOrg?.name || row.original.senderName,
                    urgency: row.original.urgency,
                    security: row.original.security as any,
                    issuedDate: row.original.issuedDate,
                    processingDeadline: row.original.processingDeadline,
                  })
                }
                title="Chỉnh sửa thông tin"
              >
                <Pencil className="h-3.5 w-3.5 mr-1 shrink-0" />
                Sửa
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs whitespace-nowrap shrink-0 px-2 text-rose-600 hover:bg-rose-50 border-rose-200"
                onClick={() => setDeletingDoc(row.original)}
                title="Xóa văn bản"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1 shrink-0" />
                Xóa
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (canView === false) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm max-w-lg mx-auto my-12">
        <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <FileText className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">
          Tài khoản của bạn hiện không có quyền xem hoặc xử lý văn bản đến. Vui lòng liên hệ Quản trị viên nếu cần cấp lại quyền.
        </p>
        <Link href="/dashboard">
          <Button variant="outline">Quay lại Bàn làm việc</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {isCitizen ? "Văn bản đến (Hồ sơ của tôi)" : "Văn bản đến"}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isCitizen
              ? "Theo dõi trạng thái, tiến độ xử lý và nhận kết quả giải quyết văn bản/hồ sơ đã nộp"
              : "Quản lý tiếp nhận, vào sổ, trình bút phê và phân công xử lý văn bản đến"}
          </p>
        </div>
        {isCitizen ? (
          <Link href="/citizen/submit">
            <Button className="gap-1.5 shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="h-4 w-4" />
              Nộp hồ sơ trực tuyến mới
            </Button>
          </Link>
        ) : (
          canCreate && (
            <Link href="/documents/incoming/new">
              <Button className="gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" />
                Vào sổ văn bản đến mới
              </Button>
            </Link>
          )
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

      {/* Dialog xác nhận xóa */}
      <ConfirmDialog
        isOpen={!!deletingDoc}
        onClose={() => setDeletingDoc(null)}
        onConfirm={handleDeleteDocument}
        isLoading={isDeleting}
        title="Xác nhận xóa văn bản đến"
        description={`Bạn có chắc chắn muốn xóa văn bản "${deletingDoc?.title}" (Số: ${deletingDoc?.documentNumber || deletingDoc?.originalCode || "Chưa cấp"}) khỏi hệ thống? Dữ liệu và các tệp đính kèm sẽ bị xóa hoàn toàn.`}
        confirmText="Xóa vĩnh viễn"
        variant="danger"
      />

      {/* Drawer chỉnh sửa thông tin */}
      <DocumentEditDrawer
        isOpen={!!editingDoc}
        onClose={() => setEditingDoc(null)}
        document={editingDoc}
        onSaved={fetchIncomingDocs}
      />
    </div>
  );
}
