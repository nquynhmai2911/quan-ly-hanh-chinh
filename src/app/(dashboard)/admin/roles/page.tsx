// src/app/(dashboard)/admin/roles/page.tsx
// Màn hình Ma trận Phân quyền & Quản lý Vai trò hệ thống

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Save, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";

interface RoleItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: Array<{ permissionId: string }>;
}

interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
}

const MODULE_NAMES: Record<string, string> = {
  "doc.incoming": "Văn bản đến",
  "doc.outgoing": "Văn bản đi & Tờ trình",
  catalog: "Danh mục dùng chung",
  admin: "Quản trị hệ thống",
  archive: "Hồ sơ lưu trữ",
  notification: "Thông báo",
};

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function fetchRolesAndPermissions() {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/roles");
      const json = await res.json();
      if (json.success) {
        setRoles(json.data.roles);
        setPermissions(json.data.permissions);

        if (json.data.roles.length > 0 && !selectedRoleId) {
          const firstRole = json.data.roles[0];
          setSelectedRoleId(firstRole.id);
          setSelectedPermIds(new Set(firstRole.permissions.map((p: { permissionId: string }) => p.permissionId)));
        }
      } else {
        toast.error(json.error?.message || "Không thể tải ma trận phân quyền.");
      }
    } catch {
      toast.error("Lỗi khi tải dữ liệu phân quyền.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRolesAndPermissions();
  }, []);

  function handleSelectRole(role: RoleItem) {
    setSelectedRoleId(role.id);
    setSelectedPermIds(new Set(role.permissions.map((p) => p.permissionId)));
  }

  function handleTogglePerm(permId: string) {
    const next = new Set(selectedPermIds);
    if (next.has(permId)) {
      next.delete(permId);
    } else {
      next.add(permId);
    }
    setSelectedPermIds(next);
  }

  async function handleSaveMatrix() {
    if (!selectedRoleId) return;
    try {
      setIsSaving(true);
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: selectedRoleId,
          permissionIds: Array.from(selectedPermIds),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Lưu phân quyền thất bại.");
        return;
      }

      toast.success("Cập nhật ma trận phân quyền thành công! Quyền mới có hiệu lực ngay.");
      fetchRolesAndPermissions();
    } catch {
      toast.error("Lỗi khi lưu phân quyền.");
    } finally {
      setIsSaving(false);
    }
  }

  // Nhóm permissions theo module
  const permsByModule: Record<string, PermissionItem[]> = {};
  permissions.forEach((p) => {
    if (!permsByModule[p.module]) {
      permsByModule[p.module] = [];
    }
    permsByModule[p.module].push(p);
  });

  const currentRole = roles.find((r) => r.id === selectedRoleId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Ma trận Phân quyền & Vai trò</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cấu hình quyền hạn chi tiết cho từng vai trò trong quy trình văn thư hành chính
          </p>
        </div>
        <Button onClick={handleSaveMatrix} isLoading={isSaving} className="gap-1.5 shadow-sm">
          <Save className="h-4 w-4" />
          Lưu thay đổi phân quyền
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Cột trái: Danh sách vai trò */}
        <div className="bg-white rounded border border-slate-200 p-3 space-y-1 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 py-1 block">
            Danh sách Vai trò
          </span>
          {roles.map((r) => {
            const isSelected = r.id === selectedRoleId;
            return (
              <button
                key={r.id}
                onClick={() => handleSelectRole(r)}
                className={`w-full flex flex-col items-start px-3 py-2.5 rounded text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : "hover:bg-slate-100 text-slate-700"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm">{r.name}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isSelected ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {r.code}
                  </span>
                </div>
                <span className={`text-[11px] mt-0.5 ${isSelected ? "text-indigo-100" : "text-slate-400"}`}>
                  {r.description || `${r.permissions.length} quyền được gán`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Cột phải: Ma trận checkbox phân theo từng module */}
        <div className="lg:col-span-3 bg-white rounded border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Quyền hạn cho vai trò: <span className="text-indigo-600">{currentRole?.name}</span>
              </h2>
              <p className="text-xs text-slate-500">
                Đã chọn {selectedPermIds.size} / {permissions.length} quyền hệ thống
              </p>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-500 text-center py-8">Đang tải ma trận phân quyền...</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(permsByModule).map(([mod, perms]) => (
                <div key={mod} className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide bg-slate-100 px-3 py-1.5 rounded">
                    {MODULE_NAMES[mod] || mod}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                    {perms.map((p) => {
                      const isChecked = selectedPermIds.has(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleTogglePerm(p.id)}
                          className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer select-none transition-colors ${
                            isChecked
                              ? "bg-indigo-50/60 border-indigo-200 text-indigo-950"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div className="mt-0.5 text-indigo-600 shrink-0">
                            {isChecked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-400" />}
                          </div>
                          <div>
                            <span className="text-xs font-semibold block">{p.name}</span>
                            <span className="text-[10px] font-mono text-slate-400 block mt-0.5">{p.code}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
