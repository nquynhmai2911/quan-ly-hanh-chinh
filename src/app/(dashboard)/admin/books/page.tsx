// src/app/(dashboard)/admin/books/page.tsx
// Màn hình Cấu hình Sổ văn bản, Mẫu số và Bộ đếm theo năm

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Hash, Tag } from "lucide-react";
import { toast } from "sonner";

interface BookItem {
  id: string;
  name: string;
  code: string;
  bookType: "INCOMING" | "OUTGOING";
  numberTemplate: string;
  description: string | null;
  isActive: boolean;
  unit?: { id: string; name: string; code: string } | null;
  documentType?: { id: string; name: string; code: string } | null;
  counters: Array<{ year: number; lastNumber: number }>;
  _count?: { documents: number };
}

export default function AdminBooksPage() {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Danh mục phục vụ form
  const [units, setUnits] = useState<Array<{ id: string; name: string; code: string }>>([]);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    bookType: "OUTGOING" as "INCOMING" | "OUTGOING",
    unitId: "",
    numberTemplate: "{number}/{typeCode}-{unitCode}",
    description: "",
  });

  async function fetchBooks() {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/books");
      const json = await res.json();
      if (json.success) {
        setBooks(json.data);
      } else {
        toast.error(json.error?.message || "Không thể tải danh sách sổ.");
      }
    } catch {
      toast.error("Lỗi khi tải danh sách sổ văn bản.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchBooks();
    // Tải units
    fetch("/api/admin/units")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setUnits(j.data);
      })
      .catch(() => {});
  }, []);

  async function handleCreateBook(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/admin/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          code: formData.code.toUpperCase(),
          unitId: formData.unitId || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Tạo sổ văn bản thất bại.");
        return;
      }
      toast.success("Thêm sổ văn bản thành công! Đã khởi tạo bộ đếm năm hiện tại.");
      setIsAddOpen(false);
      setFormData({
        name: "",
        code: "",
        bookType: "OUTGOING",
        unitId: "",
        numberTemplate: "{number}/{typeCode}-{unitCode}",
        description: "",
      });
      fetchBooks();
    } catch {
      toast.error("Lỗi kết nối.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cấu hình Sổ văn bản</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý sổ văn bản đến / đi, mẫu số ký hiệu và bộ đếm an toàn chống trùng số
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          Thêm sổ văn bản mới
        </Button>
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-100 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Tên Sổ văn bản</th>
              <th className="px-4 py-3">Mã sổ</th>
              <th className="px-4 py-3">Hình thức</th>
              <th className="px-4 py-3">Đơn vị áp dụng</th>
              <th className="px-4 py-3">Mẫu số cấu hình</th>
              <th className="px-4 py-3">Số hiện tại (Năm nay)</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                  Đang tải sổ văn bản...
                </td>
              </tr>
            ) : books.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                  Chưa có sổ văn bản nào.
                </td>
              </tr>
            ) : (
              books.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span className="font-semibold text-slate-900">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold text-slate-700">{b.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={b.bookType === "INCOMING" ? "info" : "success"}>
                      {b.bookType === "INCOMING" ? "Sổ đến" : "Sổ đi"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {b.unit ? `${b.unit.name} (${b.unit.code})` : "Toàn cơ quan"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800">
                      {b.numberTemplate}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-indigo-700">
                    {b.counters[0]?.lastNumber || 0}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={b.isActive ? "success" : "danger"}>
                      {b.isActive ? "Hoạt động" : "Đã khóa"}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Drawer
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Thêm Sổ văn bản mới"
        description="Đăng ký sổ văn bản đến hoặc đi kèm quy tắc định dạng số"
      >
        <form onSubmit={handleCreateBook} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên sổ văn bản *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="VD: Sổ Quyết định đi 2026"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mã ký hiệu sổ *</label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="VD: SQD-2026"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none font-mono uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Loại hình thức sổ *</label>
            <select
              value={formData.bookType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  bookType: e.target.value as "INCOMING" | "OUTGOING",
                  numberTemplate:
                    e.target.value === "INCOMING" ? "{number}" : "{number}/{typeCode}-{unitCode}",
                })
              }
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            >
              <option value="OUTGOING">Sổ Văn bản đi</option>
              <option value="INCOMING">Sổ Văn bản đến</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Đơn vị quản lý sổ</label>
            <select
              value={formData.unitId}
              onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            >
              <option value="">-- Dùng chung toàn cơ quan --</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mẫu định dạng số văn bản (Template) *
            </label>
            <input
              type="text"
              required
              value={formData.numberTemplate}
              onChange={(e) => setFormData({ ...formData, numberTemplate: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Biến thay thế: {"{number}"} (Số thứ tự), {"{typeCode}"} (Mã loại VB), {"{unitCode}"} (Ký hiệu đơn vị)
            </p>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Tạo sổ văn bản
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
