// src/app/(dashboard)/admin/units/page.tsx
// Màn hình Quản lý Cây Đơn vị / Phòng ban

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, CornerDownRight, Users } from "lucide-react";
import { toast } from "sonner";

interface UnitItem {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  parent?: { id: string; name: string; code: string } | null;
  _count?: { positions: number };
}

export default function AdminUnitsPage() {
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    parentId: "",
    sortOrder: 0,
  });

  async function fetchUnits() {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/units");
      const json = await res.json();
      if (json.success) {
        setUnits(json.data);
      } else {
        toast.error(json.error?.message || "Không thể tải danh sách đơn vị.");
      }
    } catch {
      toast.error("Lỗi khi tải danh sách đơn vị.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchUnits();
  }, []);

  async function handleCreateUnit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/admin/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code.toUpperCase(),
          parentId: formData.parentId || null,
          sortOrder: Number(formData.sortOrder) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Tạo đơn vị thất bại.");
        return;
      }
      toast.success("Thêm đơn vị mới thành công!");
      setIsAddOpen(false);
      setFormData({ name: "", code: "", parentId: "", sortOrder: 0 });
      fetchUnits();
    } catch {
      toast.error("Lỗi kết nối khi tạo đơn vị.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cây Đơn vị & Phòng ban</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cơ cấu tổ chức đệ quy, ký hiệu đơn vị hành chính phục vụ đánh số văn bản
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          Thêm đơn vị mới
        </Button>
      </div>

      {/* Cây cấu trúc bảng */}
      <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-100 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Tên Đơn vị / Phòng ban</th>
              <th className="px-4 py-3">Ký hiệu viết tắt</th>
              <th className="px-4 py-3">Cấp bậc</th>
              <th className="px-4 py-3">Nhân sự hiện hành</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-slate-500">
                  Đang tải cơ cấu tổ chức...
                </td>
              </tr>
            ) : units.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-slate-500">
                  Chưa có đơn vị nào được khởi tạo.
                </td>
              </tr>
            ) : (
              units.map((unit) => (
                <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${unit.level * 24}px` }}
                    >
                      {unit.level > 0 && <CornerDownRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                      <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span className="font-semibold text-slate-900">{unit.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      {unit.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">Cấp {unit.level}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-slate-700">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {unit._count?.positions || 0} cán bộ
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={unit.isActive ? "success" : "danger"}>
                      {unit.isActive ? "Hoạt động" : "Tạm dừng"}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer: Thêm đơn vị mới */}
      <Drawer
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Thêm Đơn vị / Phòng ban mới"
        description="Đăng ký thêm đơn vị trong cơ cấu hành chính cơ quan"
      >
        <form onSubmit={handleCreateUnit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên đơn vị / phòng ban *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="VD: Phòng Thanh tra - Pháp chế"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ký hiệu viết tắt (Phục vụ số văn bản: CV-TTPC) *
            </label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="VD: TTPC"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none uppercase font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Đơn vị cấp trên (Trực thuộc)</label>
            <select
              value={formData.parentId}
              onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            >
              <option value="">-- Là đơn vị cấp cao nhất (Root) --</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {"— ".repeat(u.level)} {u.name} ({u.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Thứ tự sắp xếp</label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Tạo đơn vị
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
