// src/app/(dashboard)/archives/page.tsx
// Màn hình Quản lý Hồ sơ công việc & Lưu trữ văn bản

"use client";

import React, { useState, useEffect } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { Archive, Plus, Lock, FolderOpen, FileText } from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";

interface ArchiveItem {
  id: string;
  code: string;
  title: string;
  year: number;
  retentionPeriod: string;
  isClosed: boolean;
  unit: { id: string; name: string; code: string };
  creator: { id: string; fullName: string };
  _count?: { documents: number };
}

export default function ArchivesPage() {
  const [data, setData] = useState<ArchiveItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    title: "",
    year: new Date().getFullYear(),
    retentionPeriod: "10 năm",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function fetchArchives() {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/archives?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setTotal(json.pagination?.total || 0);
      } else {
        toast.error(json.error?.message || "Không thể tải danh sách hồ sơ.");
      }
    } catch {
      toast.error("Lỗi khi tải dữ liệu hồ sơ lưu trữ.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchArchives();
  }, [page, pageSize, search]);

  async function handleCreateArchive(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/archives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Tạo hồ sơ thất bại.");
        return;
      }
      toast.success("Tạo hồ sơ công việc lưu trữ thành công!");
      setIsAddOpen(false);
      setFormData({
        code: "",
        title: "",
        year: new Date().getFullYear(),
        retentionPeriod: "10 năm",
        description: "",
      });
      fetchArchives();
    } catch {
      toast.error("Lỗi kết nối.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: ColumnDef<ArchiveItem, any>[] = [
    {
      accessorKey: "code",
      header: "Mã hồ sơ",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          {row.original.code}
        </span>
      ),
    },
    {
      accessorKey: "title",
      header: "Tiêu đề hồ sơ công việc",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-slate-900">{row.original.title}</p>
          <span className="text-[10px] text-slate-400">
            Đơn vị lập: {row.original.unit?.name} ({row.original.unit?.code}) • Người lập: {row.original.creator?.fullName}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "year",
      header: "Năm",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.year}</span>,
    },
    {
      accessorKey: "retentionPeriod",
      header: "Thời hạn bảo quản",
      cell: ({ row }) => (
        <span className="text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {row.original.retentionPeriod}
        </span>
      ),
    },
    {
      id: "count",
      header: "Số lượng văn bản",
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" />
          {row.original._count?.documents || 0} văn bản
        </span>
      ),
    },
    {
      accessorKey: "isClosed",
      header: "Tình trạng",
      cell: ({ row }) => (
        <Badge variant={row.original.isClosed ? "secondary" : "success"}>
          {row.original.isClosed ? "Đã đóng hồ sơ" : "Đang mở"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Hồ sơ công việc & Lưu trữ</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tập hợp văn bản vào hồ sơ công việc, thiết lập thời hạn bảo quản và đóng lưu trữ
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          Lập hồ sơ mới
        </Button>
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
        searchPlaceholder="Tìm kiếm theo mã hồ sơ, tiêu đề..."
      />

      <Drawer
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Lập Hồ sơ công việc mới"
        description="Đăng ký hồ sơ theo quy định lưu trữ văn thư"
      >
        <form onSubmit={handleCreateArchive} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mã hồ sơ *</label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="VD: HS-2026-TCHC-01"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề hồ sơ *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="VD: Hồ sơ về công tác tuyển dụng công chức năm 2026"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Năm hồ sơ</label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Thời hạn bảo quản</label>
              <select
                value={formData.retentionPeriod}
                onChange={(e) => setFormData({ ...formData, retentionPeriod: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              >
                <option value="5 năm">5 năm</option>
                <option value="10 năm">10 năm</option>
                <option value="20 năm">20 năm</option>
                <option value="Vĩnh viễn">Vĩnh viễn</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi chú mô tả</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Lưu hồ sơ
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
