// src/app/(dashboard)/admin/document-types/page.tsx
// Màn hình Quản trị: Cấu hình Loại hồ sơ & Mức độ khẩn cấp (SLA)

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FileStack,
  Flame,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Save,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface DocTypeItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  _count?: {
    documents: number;
    documentBooks: number;
  };
}

interface UrgencyConfigItem {
  code: "NORMAL" | "URGENT" | "FIRE";
  name: string;
  slaHours: number;
  color: string;
  description: string;
  isDefault: boolean;
  requireReason: boolean;
}

export default function AdminDocumentTypesPage() {
  const [activeTab, setActiveTab] = useState<"DOC_TYPES" | "URGENCY">("DOC_TYPES");

  // ── STATE: LOẠI HỒ SƠ ──────────────────────────────────────────────────────
  const [docTypes, setDocTypes] = useState<DocTypeItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [docSearch, setDocSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocTypeItem | null>(null);

  const [docForm, setDocForm] = useState({
    name: "",
    code: "",
    description: "",
    sortOrder: 0,
    isActive: true,
  });
  const [isSubmittingDoc, setIsSubmittingDoc] = useState(false);

  // ── STATE: CẤU HÌNH ĐỘ KHẨN ────────────────────────────────────────────────
  const [urgencyConfigs, setUrgencyConfigs] = useState<UrgencyConfigItem[]>([]);
  const [isLoadingUrgency, setIsLoadingUrgency] = useState(true);
  const [isSavingUrgency, setIsSavingUrgency] = useState(false);

  // Tải danh sách loại hồ sơ
  async function fetchDocTypes() {
    try {
      setIsLoadingDocs(true);
      const res = await fetch("/api/admin/document-types");
      const json = await res.json();
      if (json.success) {
        setDocTypes(json.data);
      } else {
        toast.error(json.error?.message || "Không thể tải danh sách loại hồ sơ.");
      }
    } catch {
      toast.error("Lỗi kết nối khi tải danh sách loại hồ sơ.");
    } finally {
      setIsLoadingDocs(false);
    }
  }

  // Tải cấu hình độ khẩn
  async function fetchUrgencyConfigs() {
    try {
      setIsLoadingUrgency(true);
      const res = await fetch("/api/admin/urgency-configs");
      const json = await res.json();
      if (json.success) {
        setUrgencyConfigs(json.data);
      } else {
        toast.error(json.error?.message || "Không thể tải cấu hình độ khẩn.");
      }
    } catch {
      toast.error("Lỗi khi tải cấu hình độ khẩn.");
    } finally {
      setIsLoadingUrgency(false);
    }
  }

  useEffect(() => {
    fetchDocTypes();
    fetchUrgencyConfigs();
  }, []);

  // ── THAO TÁC LOẠI HỒ SƠ ────────────────────────────────────────────────────
  function handleOpenAdd() {
    const nextOrder = docTypes.length > 0 ? Math.max(...docTypes.map((d) => d.sortOrder)) + 1 : 1;
    setDocForm({
      name: "",
      code: "",
      description: "",
      sortOrder: nextOrder,
      isActive: true,
    });
    setIsAddOpen(true);
  }

  function handleOpenEdit(item: DocTypeItem) {
    setSelectedDocType(item);
    setDocForm({
      name: item.name,
      code: item.code,
      description: item.description || "",
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    });
    setIsEditOpen(true);
  }

  function handleOpenDelete(item: DocTypeItem) {
    setSelectedDocType(item);
    setIsDeleteOpen(true);
  }

  async function handleCreateDocType(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSubmittingDoc(true);
      const res = await fetch("/api/admin/document-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Tạo loại hồ sơ thất bại.");
        return;
      }
      toast.success(`Đã thêm loại hồ sơ “${json.data.name}” thành công!`);
      setIsAddOpen(false);
      fetchDocTypes();
    } catch {
      toast.error("Lỗi khi thêm loại hồ sơ mới.");
    } finally {
      setIsSubmittingDoc(false);
    }
  }

  async function handleUpdateDocType(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDocType) return;
    try {
      setIsSubmittingDoc(true);
      const res = await fetch(`/api/admin/document-types/${selectedDocType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Cập nhật loại hồ sơ thất bại.");
        return;
      }
      toast.success(`Cập nhật loại hồ sơ “${json.data.name}” thành công!`);
      setIsEditOpen(false);
      fetchDocTypes();
    } catch {
      toast.error("Lỗi khi cập nhật loại hồ sơ.");
    } finally {
      setIsSubmittingDoc(false);
    }
  }

  async function handleDeleteDocType() {
    if (!selectedDocType) return;
    try {
      const res = await fetch(`/api/admin/document-types/${selectedDocType.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Không thể xóa loại hồ sơ.");
        return;
      }
      toast.success(`Đã xóa loại hồ sơ “${selectedDocType.name}”!`);
      setIsDeleteOpen(false);
      fetchDocTypes();
    } catch {
      toast.error("Lỗi khi xóa loại hồ sơ.");
    }
  }

  async function handleToggleStatus(item: DocTypeItem) {
    try {
      const nextStatus = !item.isActive;
      const res = await fetch(`/api/admin/document-types/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          nextStatus
            ? `Đã kích hoạt loại hồ sơ “${item.name}”`
            : `Đã tạm ngưng loại hồ sơ “${item.name}”`
        );
        fetchDocTypes();
      } else {
        toast.error(json.error?.message || "Không thể cập nhật trạng thái.");
      }
    } catch {
      toast.error("Lỗi khi thay đổi trạng thái.");
    }
  }

  // ── THAO TÁC CẤU HÌNH ĐỘ KHẨN ──────────────────────────────────────────────
  function handleUrgencyChange(index: number, field: keyof UrgencyConfigItem, value: any) {
    const next = [...urgencyConfigs];
    if (field === "isDefault" && value === true) {
      // Chỉ 1 mức được làm default
      next.forEach((item, i) => {
        item.isDefault = i === index;
      });
    } else {
      (next[index] as any)[field] = value;
    }
    setUrgencyConfigs(next);
  }

  async function handleSaveUrgencyConfigs() {
    try {
      setIsSavingUrgency(true);
      const res = await fetch("/api/admin/urgency-configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: urgencyConfigs }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Lưu cấu hình độ khẩn thất bại.");
        return;
      }
      toast.success("Cập nhật cấu hình Mức độ khẩn & SLA thành công!");
    } catch {
      toast.error("Lỗi kết nối khi lưu cấu hình.");
    } finally {
      setIsSavingUrgency(false);
    }
  }

  // Lọc tìm kiếm loại hồ sơ
  const filteredDocTypes = docTypes.filter((d) => {
    const q = docSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q) ||
      (d.description && d.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div>
        <div className="text-xs text-slate-500 mb-1">
          Quản trị hệ thống &gt; <span className="text-slate-800 font-medium">Loại hồ sơ & Độ khẩn</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Cấu hình Loại hồ sơ & Mức độ khẩn
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Quản lý danh mục loại văn bản, hồ sơ dịch vụ công trực tuyến và thiết lập thời hạn xử lý SLA cho từng độ khẩn.
            </p>
          </div>

          {activeTab === "DOC_TYPES" && (
            <Button
              onClick={handleOpenAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm shrink-0"
            >
              <Plus className="h-4 w-4" />
              Thêm loại hồ sơ mới
            </Button>
          )}

          {activeTab === "URGENCY" && (
            <Button
              onClick={handleSaveUrgencyConfigs}
              isLoading={isSavingUrgency}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm shrink-0"
            >
              <Save className="h-4 w-4" />
              Lưu thay đổi độ khẩn
            </Button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 mt-6 gap-8">
          <button
            onClick={() => setActiveTab("DOC_TYPES")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "DOC_TYPES"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileStack className="h-4 w-4" />
            Danh mục Loại hồ sơ & Văn bản
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {docTypes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("URGENCY")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "URGENCY"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Flame className="h-4 w-4 text-amber-500" />
            Cấu hình Mức độ khẩn & Thời hạn SLA
          </button>
        </div>
      </div>

      {/* ── TAB 1: DANH MỤC LOẠI HỒ SƠ ────────────────────────────────────────── */}
      {activeTab === "DOC_TYPES" && (
        <div className="space-y-4">
          {/* Thanh công cụ */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Tìm kiếm theo tên loại hoặc mã ký hiệu..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="text-xs text-slate-500">
              Hiển thị <span className="font-semibold text-slate-700">{filteredDocTypes.length}</span> loại hồ sơ
            </div>
          </div>

          {/* Bảng danh sách */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {isLoadingDocs ? (
              <div className="p-8 text-center text-sm text-slate-500 animate-pulse">
                Đang tải danh mục loại hồ sơ...
              </div>
            ) : filteredDocTypes.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Không tìm thấy loại hồ sơ nào phù hợp.
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-16 text-center">STT</th>
                    <th className="py-3 px-4">Tên loại hồ sơ / văn bản</th>
                    <th className="py-3 px-4 w-32">Ký hiệu (Mã)</th>
                    <th className="py-3 px-4">Mô tả hướng dẫn</th>
                    <th className="py-3 px-4 w-32 text-center">Đang dùng</th>
                    <th className="py-3 px-4 w-32 text-center">Trạng thái</th>
                    <th className="py-3 px-4 w-28 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDocTypes.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-xs text-slate-400">
                        {item.sortOrder || idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{item.name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 font-mono text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded">
                          {item.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs max-w-md truncate">
                        {item.description || "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                          {item._count?.documents || 0} hồ sơ
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            item.isActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {item.isActive ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" /> Hoạt động
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" /> Tạm dừng
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Chỉnh sửa loại hồ sơ"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            title="Xóa loại hồ sơ"
                            onClick={() => handleOpenDelete(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: CẤU HÌNH ĐỘ KHẨN & SLA ──────────────────────────────────────── */}
      {activeTab === "URGENCY" && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Quy định mức độ khẩn & Thời hạn xử lý cam kết (SLA)</div>
              <p className="text-amber-800 text-xs mt-1">
                Các mức độ khẩn dưới đây được áp dụng đồng bộ cho cả cổng Dịch vụ công (Người dân nộp) và Tiếp nhận văn bản đến/đi nội bộ. Hệ thống sẽ tự động tính toán hạn xử lý dựa trên số giờ SLA được cấu hình tại đây.
              </p>
            </div>
          </div>

          {isLoadingUrgency ? (
            <div className="p-8 text-center text-sm text-slate-500 animate-pulse">
              Đang tải cấu hình độ khẩn...
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {urgencyConfigs.map((config, idx) => {
                const colorTheme =
                  config.code === "FIRE"
                    ? {
                        headerBg: "bg-rose-50 border-rose-200",
                        badgeBg: "bg-rose-600 text-white",
                        iconColor: "text-rose-600",
                      }
                    : config.code === "URGENT"
                      ? {
                          headerBg: "bg-amber-50 border-amber-200",
                          badgeBg: "bg-amber-500 text-white",
                          iconColor: "text-amber-600",
                        }
                      : {
                          headerBg: "bg-slate-100 border-slate-200",
                          badgeBg: "bg-slate-600 text-white",
                          iconColor: "text-slate-600",
                        };

                return (
                  <div
                    key={config.code}
                    className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className={`p-4 border-b flex items-center justify-between ${colorTheme.headerBg}`}>
                        <div className="flex items-center gap-2">
                          <Flame className={`h-5 w-5 ${colorTheme.iconColor}`} />
                          <span className="font-bold text-slate-900">{config.code}</span>
                        </div>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${colorTheme.badgeBg}`}>
                          {config.name}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Tên hiển thị tiếng Việt *
                          </label>
                          <input
                            type="text"
                            value={config.name}
                            onChange={(e) => handleUrgencyChange(idx, "name", e.target.value)}
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Thời hạn SLA xử lý cam kết (Giờ) *
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="720"
                              value={config.slaHours}
                              onChange={(e) =>
                                handleUrgencyChange(idx, "slaHours", parseInt(e.target.value) || 1)
                              }
                              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                            />
                            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                              ({Math.round((config.slaHours / 24) * 10) / 10} ngày)
                            </span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Mô tả hướng dẫn cho người gửi
                          </label>
                          <textarea
                            rows={3}
                            value={config.description}
                            onChange={(e) => handleUrgencyChange(idx, "description", e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                          />
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={config.isDefault}
                              onChange={(e) => handleUrgencyChange(idx, "isDefault", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs text-slate-700">Mức độ ưu tiên mặc định</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={config.requireReason}
                              onChange={(e) => handleUrgencyChange(idx, "requireReason", e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs text-slate-700">
                              Yêu cầu giải trình lý do khi chọn mức này
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
                      <span className="text-xs text-slate-400">
                        {config.isDefault ? "★ Mặc định toàn hệ thống" : "Tùy chọn bổ sung"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={fetchUrgencyConfigs}
              className="gap-2 text-slate-600"
            >
              <RotateCcw className="h-4 w-4" />
              Khôi phục ban đầu
            </Button>
            <Button
              onClick={handleSaveUrgencyConfigs}
              isLoading={isSavingUrgency}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
            >
              <Save className="h-4 w-4" />
              Lưu cấu hình độ khẩn & SLA
            </Button>
          </div>
        </div>
      )}

      {/* ── DRAWER: THÊM LOẠI HỒ SƠ ─────────────────────────────────────────── */}
      <Drawer
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Thêm Loại hồ sơ / Loại văn bản mới"
        description="Định nghĩa loại văn bản mới dùng cho Dịch vụ công hoặc Sổ văn bản cơ quan"
        width="md"
      >
        <form onSubmit={handleCreateDocType} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên loại hồ sơ / văn bản *
            </label>
            <input
              required
              type="text"
              placeholder="VD: Đơn khiếu nại, Giấy xác nhận tình trạng..."
              value={docForm.name}
              onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mã / Ký hiệu viết tắt *
            </label>
            <input
              required
              type="text"
              placeholder="VD: DKN, GXN, CV, TTr..."
              value={docForm.code}
              onChange={(e) => setDocForm({ ...docForm, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none font-mono"
            />
            <span className="text-xs text-slate-400 mt-1 block">
              Mã dùng để đánh số ký hiệu và liên kết sổ văn bản (viết hoa, không dấu, không khoảng trắng).
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Thứ tự hiển thị
            </label>
            <input
              type="number"
              min="0"
              value={docForm.sortOrder}
              onChange={(e) => setDocForm({ ...docForm, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mô tả / Hướng dẫn
            </label>
            <textarea
              rows={3}
              placeholder="Mô tả phạm vi áp dụng hoặc giấy tờ thành phần của loại hồ sơ này..."
              value={docForm.description}
              onChange={(e) => setDocForm({ ...docForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={docForm.isActive}
                onChange={(e) => setDocForm({ ...docForm, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Kích hoạt sử dụng ngay</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              isLoading={isSubmittingDoc}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Lưu loại hồ sơ
            </Button>
          </div>
        </form>
      </Drawer>

      {/* ── DRAWER: SỬA LOẠI HỒ SƠ ─────────────────────────────────────────── */}
      <Drawer
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Chỉnh sửa: ${selectedDocType?.name}`}
        description={`Ký hiệu mã: ${selectedDocType?.code}`}
        width="md"
      >
        <form onSubmit={handleUpdateDocType} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tên loại hồ sơ / văn bản *
            </label>
            <input
              required
              type="text"
              value={docForm.name}
              onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mã / Ký hiệu viết tắt *
            </label>
            <input
              required
              type="text"
              value={docForm.code}
              onChange={(e) => setDocForm({ ...docForm, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Thứ tự hiển thị
            </label>
            <input
              type="number"
              min="0"
              value={docForm.sortOrder}
              onChange={(e) => setDocForm({ ...docForm, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mô tả / Hướng dẫn
            </label>
            <textarea
              rows={3}
              value={docForm.description}
              onChange={(e) => setDocForm({ ...docForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={docForm.isActive}
                onChange={(e) => setDocForm({ ...docForm, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Đang hoạt động</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsEditOpen(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              isLoading={isSubmittingDoc}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Cập nhật
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteDocType}
        title="Xác nhận xóa loại hồ sơ"
        description={`Bạn có chắc chắn muốn xóa vĩnh viễn loại hồ sơ “${selectedDocType?.name}” (${selectedDocType?.code})? Nếu loại hồ sơ đã phát sinh văn bản thực tế, bạn nên chọn Tắt hoạt động.`}
        confirmText="Xác nhận xóa"
        variant="danger"
      />
    </div>
  );
}

