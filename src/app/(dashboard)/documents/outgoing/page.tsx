// src/app/(dashboard)/documents/outgoing/page.tsx
// Màn hình Danh sách Văn bản đi / Tờ trình: Phân trang Server-side, Tabs trạng thái, Chi tiết chuỗi duyệt

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge, DocumentStatusBadge, UrgencyBadge, SecurityBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DocumentEditDrawer, EditableDocument } from "@/components/documents/document-edit-drawer";
import { Send, Plus, Eye, CheckCircle2, Clock, Pencil, Trash2 } from "lucide-react";
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
  const [editingDoc, setEditingDoc] = useState<EditableDocument | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<OutgoingItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [canView, setCanView] = useState<boolean | null>(null);
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const roles = j.data.roles || [];
          const permissions = j.data.permissions || {};
          const isAdmin = roles.includes("ADMIN");
          const hasView =
            isAdmin ||
            Boolean(permissions["doc.outgoing.view"]) ||
            Boolean(permissions["doc.outgoing.create"]);
          setCanView(hasView);

          const hasCreate =
            isAdmin ||
            Boolean(permissions["doc.outgoing.create"]);
          setCanCreate(hasCreate);
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
      fetchOutgoingDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi khi xóa văn bản.");
    } finally {
      setIsDeleting(false);
    }
  }

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOutgoingDocs();
  }, [page, pageSize, search, statusFilter]);

  const columns: ColumnDef<OutgoingItem, unknown>[] = [
    {
      accessorKey: "documentNumber",
      header: () => <span className="whitespace-nowrap">Số / Ký hiệu</span>,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-slate-800 whitespace-nowrap">
          {row.original.documentNumber || <span className="text-slate-400 italic">Dự thảo</span>}
        </span>
      ),
    },
    {
      id: "unit",
      header: () => <span className="whitespace-nowrap">Đơn vị soạn thảo</span>,
      cell: ({ row }) => (
        <span className="text-xs text-slate-700 font-medium whitespace-nowrap">
          {row.original.draftUnit?.name || "—"} ({row.original.draftUnit?.code})
        </span>
      ),
    },
    {
      accessorKey: "title",
      header: () => <span className="whitespace-nowrap">Trích yếu dự thảo</span>,
      cell: ({ row }) => (
        <div className="min-w-[240px] max-w-md">
          <p className="font-semibold text-slate-900 line-clamp-2 hover:text-indigo-600 transition-colors">
            {row.original.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
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
      header: () => <span className="whitespace-nowrap">Trạng thái</span>,
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          <DocumentStatusBadge status={row.original.status} />
        </div>
      ),
    },
    {
      id: "approvals",
      header: () => <span className="whitespace-nowrap">Tiến độ duyệt</span>,
      cell: ({ row }) => {
        const apps = row.original.approvals || [];
        if (apps.length === 0) return <span className="text-slate-400 italic text-xs whitespace-nowrap">Chưa tạo chuỗi</span>;
        return (
          <div className="flex items-center gap-1 whitespace-nowrap">
            {apps.map((a, i) => (
              <span
                key={i}
                title={`${a.role}: ${a.approver?.fullName || "Cán bộ"} (${a.status})`}
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold whitespace-nowrap ${
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
      header: () => <span className="whitespace-nowrap">Người ký</span>,
      cell: ({ row }) => (
        <div className="text-xs whitespace-nowrap">
          <span className="font-medium text-slate-800 block">{row.original.signerName || "Chưa chọn"}</span>
          {row.original.signerPosition && (
            <span className="text-[10px] text-slate-400 block">{row.original.signerPosition}</span>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="whitespace-nowrap text-right block pr-2">Thao tác</span>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap pr-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs whitespace-nowrap shrink-0 px-2 text-slate-700 hover:bg-slate-50 border-slate-200"
            onClick={() => router.push(`/documents/${row.original.id}`)}
          >
            <Eye className="h-3.5 w-3.5 mr-1 text-slate-500 shrink-0" />
            Chi tiết
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs whitespace-nowrap shrink-0 px-2 text-indigo-700 hover:bg-indigo-50 border-indigo-200"
            onClick={() =>
              setEditingDoc({
                id: row.original.id,
                direction: "OUTGOING",
                title: row.original.title,
                documentNumber: row.original.documentNumber,
                signerName: row.original.signerName,
                signerPosition: row.original.signerPosition,
                urgency: row.original.urgency,
                security: row.original.security,
                issuedDate: row.original.issuedDate,
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
        </div>
      ),
    },
  ];

  if (canView === false) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm max-w-lg mx-auto my-12">
        <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <Send className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">
          Tài khoản của bạn hiện không có quyền xem hoặc soạn thảo văn bản đi. Vui lòng liên hệ Quản trị viên nếu cần cấp lại quyền.
        </p>
        <Link href="/dashboard">
          <Button variant="outline">Quay lại Bàn làm việc</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Văn bản đi & Tờ trình</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý quy trình soạn thảo dự thảo, phê duyệt nối tiếp, cấp số và ban hành văn bản
          </p>
        </div>
        {canCreate && (
          <Link href="/documents/outgoing/new">
            <Button className="gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              Tạo dự thảo văn bản đi mới
            </Button>
          </Link>
        )}
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

      {/* Dialog xác nhận xóa */}
      <ConfirmDialog
        isOpen={!!deletingDoc}
        onClose={() => setDeletingDoc(null)}
        onConfirm={handleDeleteDocument}
        isLoading={isDeleting}
        title="Xác nhận xóa văn bản đi / dự thảo"
        description={`Bạn có chắc chắn muốn xóa văn bản "${deletingDoc?.title}" (Số: ${deletingDoc?.documentNumber || "Chưa cấp"}) khỏi hệ thống? Dữ liệu và các tệp đính kèm sẽ bị xóa hoàn toàn.`}
        confirmText="Xóa vĩnh viễn"
        variant="danger"
      />

      {/* Drawer chỉnh sửa thông tin */}
      <DocumentEditDrawer
        isOpen={!!editingDoc}
        onClose={() => setEditingDoc(null)}
        document={editingDoc}
        onSaved={fetchOutgoingDocs}
      />
    </div>
  );
}
