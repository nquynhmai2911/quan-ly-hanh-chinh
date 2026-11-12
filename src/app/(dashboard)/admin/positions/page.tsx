// src/app/(dashboard)/admin/positions/page.tsx
// Màn hình Quản lý Chức danh cán bộ (Đồng bộ theo 4 vai trò: admin, Lãnh đạo, Chuyên viên, Văn thư)

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Briefcase,
  Plus,
  Users,
  Zap,
  Crown,
  User,
  FileText,
  Pencil,
  Trash2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface PositionItem {
  id: string;
  name: string;
  level: number;
  isActive: boolean;
  _count?: { userPositions: number };
}

// 4 chức danh mẫu tương ứng 4 vai trò chuẩn
const STANDARD_PRESETS = [
  { name: "Quản trị hệ thống", level: 0, role: "admin", desc: "Quản trị toàn bộ hệ thống" },
  { name: "Lãnh đạo", level: 1, role: "LEADER", desc: "Bút phê, chỉ đạo, duyệt và ký số" },
  { name: "Chuyên viên", level: 2, role: "SPECIALIST", desc: "Thụ lý xử lý, soạn thảo dự thảo" },
  { name: "Người dân", level: 3, role: "CITIZEN", desc: "Nộp hồ sơ trực tuyến, theo dõi tiến độ" },
];

export default function AdminPositionsPage() {
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Drawer Add
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    level: 0,
  });

  // Drawer Edit
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPos, setSelectedPos] = useState<PositionItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    level: 0,
    isActive: true,
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Dialog Delete
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Xác định vai trò tương ứng với chức danh theo 4 role chuẩn
  function getPositionRoleBadge(name: string) {
    const n = name.toLowerCase();
    if (n.includes("quản trị") || n.includes("admin")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
          <Zap className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
          Quản trị viên (Admin)
        </span>
      );
    }
    if (
      n.includes("lãnh đạo") ||
      n.includes("giám đốc") ||
      n.includes("trưởng phòng") ||
      n.includes("quản lý")
    ) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
          <Crown className="h-3.5 w-3.5 text-purple-600" />
          Lãnh đạo
        </span>
      );
    }
    if (n.includes("văn thư") || n.includes("lưu trữ")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
          <FileText className="h-3.5 w-3.5 text-amber-600" />
          Văn thư
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
        <User className="h-3.5 w-3.5 text-blue-600" />
        Chuyên viên
      </span>
    );
  }

  // Thêm chức danh mới
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
      toast.error("Lỗi kết nối khi thêm chức danh.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Mở drawer sửa chức danh
  function handleOpenEdit(pos: PositionItem) {
    setSelectedPos(pos);
    setEditFormData({
      name: pos.name,
      level: pos.level,
      isActive: pos.isActive,
    });
    setIsEditOpen(true);
  }

  // Lưu sửa chức danh
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPos) return;
    try {
      setIsSubmittingEdit(true);
      const res = await fetch(`/api/admin/positions/${selectedPos.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Cập nhật chức danh thất bại.");
        return;
      }
      toast.success("Cập nhật chức danh thành công!");
      setIsEditOpen(false);
      fetchPositions();
    } catch {
      toast.error("Lỗi khi cập nhật chức danh.");
    } finally {
      setIsSubmittingEdit(false);
    }
  }

  // Mở dialog xóa / khóa chức danh
  function handleOpenDelete(pos: PositionItem) {
    setSelectedPos(pos);
    setIsDeleteOpen(true);
  }

  // Xác nhận xóa chức danh
  async function handleConfirmDelete() {
    if (!selectedPos) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/admin/positions/${selectedPos.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Xóa chức danh thất bại.");
        return;
      }
      toast.success(json.data?.message || "Xóa chức danh thành công.");
      setIsDeleteOpen(false);
      fetchPositions();
    } catch {
      toast.error("Lỗi khi xóa chức danh.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500 mb-1">
            Quản trị hệ thống &gt; <span className="text-slate-800 font-medium">Chức danh</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Danh mục Chức danh
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Đồng bộ 4 Role
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Danh sách chức danh được chuẩn hóa đồng bộ với 4 vai trò chính: <strong>Quản trị viên</strong>, <strong>Lãnh đạo</strong>, <strong>Chuyên viên</strong>, <strong>Người dân</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsAddOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Thêm chức danh mới
          </Button>
        </div>
      </div>

      {/* ── BẢNG DANH MỤC CHỨC DANH ────────────────────────────────────────── */}
      <div className="bg-white rounded border border-slate-200 overflow-x-auto shadow-xs">
        <table className="w-full min-w-[850px] text-left text-sm text-slate-700">
          <thead className="bg-slate-100 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap">Tên Chức danh</th>
              <th className="px-4 py-3 whitespace-nowrap">Vai trò tương ứng (Role)</th>
              <th className="px-4 py-3 whitespace-nowrap">Cấp bậc</th>
              <th className="px-4 py-3 whitespace-nowrap">Số lượng cán bộ đang giữ</th>
              <th className="px-4 py-3 whitespace-nowrap">Trạng thái</th>
              <th className="px-4 py-3 text-right pr-6 whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                  Đang tải danh sách chức danh...
                </td>
              </tr>
            ) : positions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-slate-500">
                  Chưa có chức danh nào.
                </td>
              </tr>
            ) : (
              positions.map((pos) => (
                <tr key={pos.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 block">{pos.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono">ID: #{pos.id.slice(-6)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {getPositionRoleBadge(pos.name)}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-600 font-medium">
                    Bậc {pos.level} {pos.level === 0 ? "(Cao nhất)" : ""}
                  </td>
                  <td className="px-4 py-3.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium">
                      <Users className="h-3.5 w-3.5 text-slate-500" />
                      {pos._count?.userPositions || 0} cán bộ
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={pos.isActive ? "success" : "danger"}>
                      {pos.isActive ? "Hoạt động" : "Tạm dừng"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-right pr-6">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(pos)}
                        title="Chỉnh sửa chức danh"
                        className="p-1.5 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(pos)}
                        title="Xóa hoặc ngừng hoạt động"
                        className="p-1.5 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── DRAWER: THÊM CHỨC DANH MỚI ─────────────────────────────────────── */}
      <Drawer
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Thêm Chức danh mới"
        description="Đăng ký chức danh và liên kết vai trò trong hệ thống"
      >
        <form onSubmit={handleCreatePosition} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Gợi ý theo 4 vai trò chuẩn
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {STANDARD_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => setFormData({ name: p.name, level: p.level })}
                  className="p-2 text-left rounded border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all text-xs"
                >
                  <span className="font-semibold text-slate-900 block">{p.name}</span>
                  <span className="text-[10px] text-slate-500">Bậc {p.level} • {p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên chức danh *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="VD: Quản trị hệ thống, Lãnh đạo, Chuyên viên..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cấp bậc (0 = Cao nhất) *
            </label>
            <input
              type="number"
              required
              min={0}
              max={10}
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              0: Admin • 1: Lãnh đạo • 2: Chuyên viên • 3: Người dân
            </p>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Tạo chức danh
            </Button>
          </div>
        </form>
      </Drawer>

      {/* ── DRAWER: CHỈNH SỬA CHỨC DANH ───────────────────────────────────── */}
      <Drawer
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Chỉnh sửa: ${selectedPos?.name}`}
        description="Cập nhật tên chức danh, cấp bậc và trạng thái hoạt động"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên chức danh *
            </label>
            <input
              type="text"
              required
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cấp bậc *
            </label>
            <input
              type="number"
              required
              min={0}
              max={10}
              value={editFormData.level}
              onChange={(e) =>
                setEditFormData({ ...editFormData, level: Number(e.target.value) })
              }
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Trạng thái
            </label>
            <select
              value={editFormData.isActive ? "true" : "false"}
              onChange={(e) =>
                setEditFormData({ ...editFormData, isActive: e.target.value === "true" })
              }
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            >
              <option value="true">Đang hoạt động</option>
              <option value="false">Tạm dừng hoạt động</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsEditOpen(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              isLoading={isSubmittingEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Drawer>

      {/* ── DIALOG XÁC NHẬN XÓA CHỨC DANH ─────────────────────────────────── */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Xóa hoặc ngừng hoạt động chức danh"
        description={`Bạn có chắc muốn xóa chức danh "${selectedPos?.name}"? Nếu đang có cán bộ đảm nhiệm, chức danh sẽ tự động chuyển sang trạng thái tạm dừng.`}
        confirmText="Xác nhận"
        cancelText="Đóng"
        variant="danger"
      />
    </div>
  );
}
