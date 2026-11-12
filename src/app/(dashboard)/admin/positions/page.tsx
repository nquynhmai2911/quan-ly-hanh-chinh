// src/app/(dashboard)/admin/positions/page.tsx
// Màn hình Quản lý Chức danh cán bộ

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Plus, Users } from "lucide-react";
import { toast } from "sonner";

interface PositionItem {
  id: string;
  name: string;
  level: number;
  isActive: boolean;
  _count?: { userPositions: number };
}

export default function AdminPositionsPage() {
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    level: 0,
  });

  async function fetchPositions() {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/positions");
      const json = await res.json();
      if (json.success) {
        setPositions(json.data);
      } else {
        toast.error(json.error?.message || "Không thể tải danh sách chức danh.");
      }
    } catch {
      toast.error("Lỗi khi tải danh sách chức danh.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPositions();
  }, []);

  async function handleCreatePosition(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/admin/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Tạo chức danh thất bại.");
        return;
      }
      toast.success("Thêm chức danh mới thành công!");
      setIsAddOpen(false);
      setFormData({ name: "", level: 0 });
      fetchPositions();
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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Danh mục Chức danh</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Danh sách chức danh lãnh đạo, quản lý và chuyên môn trong cơ quan
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          Thêm chức danh mới
        </Button>
      </div>

      <div className="bg-white rounded border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-100 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Tên Chức danh</th>
              <th className="px-4 py-3">Cấp bậc</th>
              <th className="px-4 py-3">Số lượng cán bộ đang giữ</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-sm text-slate-500">
                  Đang tải danh sách chức danh...
                </td>
              </tr>
            ) : positions.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-sm text-slate-500">
                  Chưa có chức danh nào.
                </td>
              </tr>
            ) : (
              positions.map((pos) => (
                <tr key={pos.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span className="font-semibold text-slate-900">{pos.name}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    Bậc {pos.level} {pos.level === 0 ? "(Cao nhất)" : ""}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-slate-700">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {pos._count?.userPositions || 0} cán bộ
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={pos.isActive ? "success" : "danger"}>
                      {pos.isActive ? "Hoạt động" : "Tạm dừng"}
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
        title="Thêm Chức danh mới"
        description="Đăng ký chức danh mới trong hệ thống"
      >
        <form onSubmit={handleCreatePosition} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tên chức danh *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="VD: Trợ lý Giám đốc, Kế toán trưởng"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cấp bậc (0 = Cao nhất) *</label>
            <input
              type="number"
              required
              min={0}
              max={10}
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Tạo chức danh
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
