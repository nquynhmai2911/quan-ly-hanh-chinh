// src/app/(dashboard)/admin/users/page.tsx
// Màn hình Quản lý Tài khoản & Phân quyền (Theo mẫu giao diện Ảnh 2 + Phân quyền theo từng tài khoản)

"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  UserPlus,
  Shield,
  ShieldCheck,
  Building,
  KeyRound,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  CheckSquare,
  Square,
  Search,
  Filter,
  Save,
  Zap,
  Crown,
  FileText,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";

interface UserItem {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  positions: Array<{
    id: string;
    isPrimary: boolean;
    unit: { id: string; name: string; code: string };
    position: { id: string; name: string };
    roles: Array<{
      role: { id: string; name: string; code: string };
      dataScope: string;
    }>;
  }>;
  userPermissions?: Array<{
    id: string;
    permissionId: string;
    dataScope: string;
    permission: {
      id: string;
      code: string;
      name: string;
      module: string;
    };
  }>;
}

interface PermissionItem {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
}

interface RoleMatrixItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: Array<{ permissionId: string }>;
}

interface UserPermissionDetail {
  user: {
    id: string;
    employeeCode: string;
    fullName: string;
    email: string;
  };
  roles: Array<{ id: string; name: string; code: string; dataScope: string }>;
  inheritedPermissionIds: string[];
  directPermissions: Array<{
    id: string;
    permissionId: string;
    dataScope: string;
    code: string;
    name: string;
    module: string;
  }>;
  allPermissions: PermissionItem[];
}

const MODULE_NAMES: Record<string, string> = {
  "doc.incoming": "Văn bản đến",
  "doc.outgoing": "Văn bản đi & Tờ trình",
  catalog: "Danh mục dùng chung",
  admin: "Quản trị hệ thống",
  archive: "Hồ sơ lưu trữ",
  notification: "Thông báo & Nhật ký",
};

// Bảng màu pastel cho Avatar dựa theo chữ cái hoặc vai trò (như ảnh mẫu)
const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  ADMIN: { bg: "bg-rose-100", text: "text-rose-600" },
  LEADER: { bg: "bg-purple-100", text: "text-purple-700" },
  DEPT_HEAD: { bg: "bg-indigo-100", text: "text-indigo-700" },
  CLERK: { bg: "bg-amber-100", text: "text-amber-700" },
  SPECIALIST: { bg: "bg-blue-100", text: "text-blue-700" },
  CITIZEN: { bg: "bg-emerald-100", text: "text-emerald-700" },
};

export default function AdminUsersPage() {
  // Tab điều hướng chính: Phân quyền theo Tài khoản hoặc Vai trò
  const [activeTab, setActiveTab] = useState<"ACCOUNTS" | "ROLES">("ACCOUNTS");

  // States cho Tab Phân quyền theo Vai trò (Role Matrix)
  const [matrixRoles, setMatrixRoles] = useState<RoleMatrixItem[]>([]);
  const [matrixPerms, setMatrixPerms] = useState<PermissionItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedRolePermIds, setSelectedRolePermIds] = useState<Set<string>>(new Set());
  const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);

  const [data, setData] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Danh mục dùng chung
  const [units, setUnits] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [positions, setPositions] = useState<Array<{ id: string; name: string }>>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string; code: string }>>([]);

  // Drawer states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPermDrawerOpen, setIsPermDrawerOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // State cho Drawer Phân quyền theo từng tài khoản
  const [userPermDetail, setUserPermDetail] = useState<UserPermissionDetail | null>(null);
  const [isLoadingPerms, setIsLoadingPerms] = useState(false);
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const [permSearch, setPermSearch] = useState("");
  const [permFilter, setPermFilter] = useState<"ALL" | "DIRECT" | "INHERITED">("ALL");
  // Map lưu permissionId -> dataScope cho các quyền riêng
  const [directPermsMap, setDirectPermsMap] = useState<Map<string, string>>(new Map());
  const userPermCache = useRef<Map<string, UserPermissionDetail>>(new Map());

  // Form Thêm tài khoản mới
  const [addForm, setAddForm] = useState({
    employeeCode: "",
    fullName: "",
    email: "",
    phone: "",
    password: "User@123",
    unitId: "",
    positionId: "",
    roleId: "",
    dataScope: "OWN",
  });
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Form Sửa thông tin tài khoản
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    isActive: true,
    unitId: "",
    positionId: "",
    roleId: "",
    dataScope: "OWN",
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchUsers() {
    try {
      setIsLoading(true);
      const res = await fetch(
        `/api/admin/users?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`
      );
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setTotal(json.pagination?.total || 0);
      } else {
        toast.error(json.error?.message || "Không thể tải danh sách tài khoản.");
      }
    } catch {
      toast.error("Lỗi kết nối khi tải danh sách người dùng.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCatalogs() {
    try {
      const [resUnits, resPositions, resRoles] = await Promise.all([
        fetch("/api/admin/units").then((r) => r.json()),
        fetch("/api/admin/positions").then((r) => r.json()),
        fetch("/api/admin/roles").then((r) => r.json()),
      ]);

      if (resUnits.success) setUnits(resUnits.data);
      if (resPositions.success) setPositions(resPositions.data);
      if (resRoles.success) setRoles(resRoles.data.roles);

      if (resUnits.data?.[0]) setAddForm((prev) => ({ ...prev, unitId: resUnits.data[0].id }));
      if (resPositions.data?.[0]) setAddForm((prev) => ({ ...prev, positionId: resPositions.data[0].id }));
      if (resRoles.data?.roles?.[0]) setAddForm((prev) => ({ ...prev, roleId: resRoles.data.roles[0].id }));
    } catch {
      console.error("Không thể tải danh mục.");
    }
  }

  // Tải danh mục 1 lần duy nhất khi mount
  useEffect(() => {
    loadCatalogs();
    if (typeof window !== "undefined") {
      const tabParam = new URLSearchParams(window.location.search).get("tab");
      if (tabParam === "roles") {
        setActiveTab("ROLES");
        fetchRoleMatrix();
      }
    }
  }, []);

  // Tải ma trận phân quyền vai trò
  async function fetchRoleMatrix() {
    try {
      setIsLoadingMatrix(true);
      const res = await fetch("/api/admin/roles");
      const json = await res.json();
      if (json.success) {
        setMatrixRoles(json.data.roles);
        setMatrixPerms(json.data.permissions);

        if (json.data.roles.length > 0) {
          setSelectedRoleId((prev) => {
            const found = json.data.roles.find((r: RoleMatrixItem) => r.id === prev) || json.data.roles[0];
            setSelectedRolePermIds(new Set(found.permissions.map((p: { permissionId: string }) => p.permissionId)));
            return found.id;
          });
        }
      } else {
        toast.error(json.error?.message || "Không thể tải ma trận phân quyền vai trò.");
      }
    } catch {
      toast.error("Lỗi khi tải dữ liệu phân quyền vai trò.");
    } finally {
      setIsLoadingMatrix(false);
    }
  }

  function handleSelectRole(role: RoleMatrixItem) {
    setSelectedRoleId(role.id);
    setSelectedRolePermIds(new Set(role.permissions.map((p) => p.permissionId)));
  }

  function handleToggleRolePerm(permId: string) {
    const next = new Set(selectedRolePermIds);
    if (next.has(permId)) {
      next.delete(permId);
    } else {
      next.add(permId);
    }
    setSelectedRolePermIds(next);
  }

  function handleSelectAllMatrixPerms() {
    setSelectedRolePermIds(new Set(matrixPerms.map((p) => p.id)));
  }

  function handleClearAllMatrixPerms() {
    setSelectedRolePermIds(new Set());
  }

  async function handleSaveRoleMatrix() {
    if (!selectedRoleId) return;
    try {
      setIsSavingMatrix(true);
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleId: selectedRoleId,
          permissionIds: Array.from(selectedRolePermIds),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Lưu phân quyền vai trò thất bại.");
        return;
      }

      toast.success("Cập nhật phân quyền cho vai trò thành công! Quyền mới có hiệu lực tức thì.");
      setMatrixRoles((prev) =>
        prev.map((r) =>
          r.id === selectedRoleId
            ? {
                ...r,
                permissions: Array.from(selectedRolePermIds).map((pId) => ({ permissionId: pId })),
              }
            : r
        )
      );
      userPermCache.current.clear();
    } catch {
      toast.error("Lỗi khi lưu phân quyền vai trò.");
    } finally {
      setIsSavingMatrix(false);
    }
  }

  // Tải danh sách user có debounce nhẹ khi tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 200);
    return () => clearTimeout(timer);
  }, [page, pageSize, search]);

  // ── MỞ DRAWER PHÂN QUYỀN RIÊNG CHO TÀI KHOẢN ─────────────────────────────
  async function handleOpenPermissions(user: UserItem) {
    setSelectedUser(user);
    setIsPermDrawerOpen(true);
    setPermSearch("");
    setPermFilter("ALL");

    // Nếu đã có cache trong session thì hiển thị ngay lập tức (0ms delay)
    if (userPermCache.current.has(user.id)) {
      const cached = userPermCache.current.get(user.id)!;
      setUserPermDetail(cached);
      const directMap = new Map<string, string>();
      cached.directPermissions.forEach((dp) => {
        directMap.set(dp.permissionId, dp.dataScope || "OWN");
      });
      setDirectPermsMap(directMap);
      setIsLoadingPerms(false);
    } else {
      setIsLoadingPerms(true);
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}/permissions`);
      const json = await res.json();

      if (json.success) {
        userPermCache.current.set(user.id, json.data);
        setUserPermDetail(json.data);
        // Khởi tạo map các quyền riêng
        const directMap = new Map<string, string>();
        json.data.directPermissions.forEach((dp: { permissionId: string; dataScope: string }) => {
          directMap.set(dp.permissionId, dp.dataScope || "OWN");
        });
        setDirectPermsMap(directMap);
      } else if (!userPermCache.current.has(user.id)) {
        toast.error(json.error?.message || "Không thể tải thông tin phân quyền tài khoản.");
      }
    } catch {
      if (!userPermCache.current.has(user.id)) {
        toast.error("Lỗi khi tải thông tin phân quyền của người dùng.");
      }
    } finally {
      setIsLoadingPerms(false);
    }
  }

  // Toggle phân quyền riêng cho user
  function handleToggleDirectPerm(permId: string) {
    const nextMap = new Map(directPermsMap);
    if (nextMap.has(permId)) {
      nextMap.delete(permId);
    } else {
      nextMap.set(permId, "OWN");
    }
    setDirectPermsMap(nextMap);
  }

  // Thay đổi DataScope của quyền riêng
  function handleChangeDirectScope(permId: string, scope: string) {
    const nextMap = new Map(directPermsMap);
    nextMap.set(permId, scope);
    setDirectPermsMap(nextMap);
  }

  // Chọn tất cả quyền
  function handleSelectAllPerms() {
    if (!userPermDetail) return;
    const nextMap = new Map<string, string>();
    userPermDetail.allPermissions.forEach((p) => {
      // Chỉ cấp quyền riêng cho các quyền chưa có trong vai trò
      if (!userPermDetail.inheritedPermissionIds.includes(p.id)) {
        nextMap.set(p.id, "OWN");
      }
    });
    setDirectPermsMap(nextMap);
    toast.info("Đã chọn cấp tất cả các quyền còn thiếu cho tài khoản.");
  }

  // Xóa toàn bộ quyền riêng
  function handleClearDirectPerms() {
    setDirectPermsMap(new Map());
    toast.info("Đã khôi phục quyền mặc định hoàn toàn theo Vai trò.");
  }

  // Lưu phân quyền riêng cho người dùng
  async function handleSaveUserPermissions() {
    if (!selectedUser) return;
    try {
      setIsSavingPerms(true);
      const permissionsPayload = Array.from(directPermsMap.entries()).map(([permissionId, dataScope]) => ({
        permissionId,
        dataScope,
      }));

      const res = await fetch(`/api/admin/users/${selectedUser.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: permissionsPayload }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Lưu phân quyền tài khoản thất bại.");
        return;
      }

      toast.success(
        `Cập nhật phân quyền cho tài khoản ${selectedUser.fullName} thành công! Quyền mới có hiệu lực tức thì.`
      );
      if (selectedUser) {
        userPermCache.current.delete(selectedUser.id);
      }
      setIsPermDrawerOpen(false);
      fetchUsers();
    } catch {
      toast.error("Lỗi khi lưu phân quyền cho người dùng.");
    } finally {
      setIsSavingPerms(false);
    }
  }

  // ── MỞ DRAWER SỬA TÀI KHOẢN ──────────────────────────────────────────────
  function handleOpenEdit(user: UserItem) {
    setSelectedUser(user);
    const primary = user.positions.find((p) => p.isPrimary) || user.positions[0];
    const role = primary?.roles?.[0];

    setEditForm({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || "",
      password: "",
      isActive: user.isActive,
      unitId: primary?.unit?.id || units[0]?.id || "",
      positionId: primary?.position?.id || positions[0]?.id || "",
      roleId: role?.role?.id || roles[0]?.id || "",
      dataScope: role?.dataScope || "OWN",
    });
    setIsEditOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setIsSubmittingEdit(true);

      // 1. Cập nhật thông tin cơ bản
      const resUser = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editForm.fullName,
          email: editForm.email,
          phone: editForm.phone,
          isActive: editForm.isActive,
          ...(editForm.password ? { password: editForm.password } : {}),
        }),
      });
      const jsonUser = await resUser.json();
      if (!resUser.ok || !jsonUser.success) {
        toast.error(jsonUser.error?.message || "Cập nhật thông tin thất bại.");
        return;
      }

      // 2. Cập nhật chức vụ & vai trò nếu có chọn
      if (editForm.unitId && editForm.positionId && editForm.roleId) {
        await fetch(`/api/admin/users/${selectedUser.id}/position`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unitId: editForm.unitId,
            positionId: editForm.positionId,
            roleId: editForm.roleId,
            dataScope: editForm.dataScope,
          }),
        });
      }

      toast.success("Cập nhật thông tin tài khoản thành công!");
      setIsEditOpen(false);
      fetchUsers();
    } catch {
      toast.error("Lỗi khi cập nhật tài khoản.");
    } finally {
      setIsSubmittingEdit(false);
    }
  }

  // ── XÓA / KHÓA TÀI KHOẢN ─────────────────────────────────────────────────
  function handleOpenDelete(user: UserItem) {
    setSelectedUser(user);
    setIsConfirmDeleteOpen(true);
  }

  async function handleConfirmDelete() {
    if (!selectedUser) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Không thể xóa hoặc khóa tài khoản.");
        return;
      }

      toast.success(json.data?.message || "Thao tác thành công.");
      setIsConfirmDeleteOpen(false);
      fetchUsers();
    } catch {
      toast.error("Lỗi khi xử lý xóa/khóa tài khoản.");
    } finally {
      setIsDeleting(false);
    }
  }

  // ── THÊM TÀI KHOẢN MỚI ───────────────────────────────────────────────────
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSubmittingAdd(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode: addForm.employeeCode,
          fullName: addForm.fullName,
          email: addForm.email,
          phone: addForm.phone,
          password: addForm.password,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Tạo tài khoản thất bại.");
        return;
      }

      const createdUser = json.data;
      // Gán chức vụ và vai trò ban đầu nếu có chọn
      if (addForm.unitId && addForm.positionId && addForm.roleId) {
        await fetch(`/api/admin/users/${createdUser.id}/position`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unitId: addForm.unitId,
            positionId: addForm.positionId,
            roleId: addForm.roleId,
            dataScope: addForm.dataScope,
          }),
        });
      }

      toast.success("Tạo tài khoản và phân quyền ban đầu thành công!");
      setIsAddOpen(false);
      setAddForm({
        employeeCode: "",
        fullName: "",
        email: "",
        phone: "",
        password: "User@123",
        unitId: units[0]?.id || "",
        positionId: positions[0]?.id || "",
        roleId: roles[0]?.id || "",
        dataScope: "OWN",
      });
      fetchUsers();
    } catch {
      toast.error("Lỗi khi thêm người dùng.");
    } finally {
      setIsSubmittingAdd(false);
    }
  }

  // Helper tính màu và icon cho vai trò (như mẫu ảnh 2)
  function getRoleBadge(user: UserItem) {
    const primary = user.positions.find((p) => p.isPrimary) || user.positions[0];
    const role = primary?.roles?.[0]?.role;
    const roleCode = role?.code || "SPECIALIST";

    let label = role?.name || "Chuyên viên";
    let icon = <User className="h-3.5 w-3.5" />;
    let style = "bg-blue-50 text-blue-700 border-blue-200";

    if (roleCode === "ADMIN") {
      label = "Quản trị viên (Admin)";
      icon = <Zap className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />;
      style = "bg-rose-50 text-rose-700 border-rose-200";
    } else if (roleCode === "LEADER" || roleCode === "DEPT_HEAD") {
      label = "Lãnh đạo";
      icon = <Crown className="h-3.5 w-3.5 text-purple-600" />;
      style = "bg-purple-50 text-purple-700 border-purple-200";
    } else if (roleCode === "SPECIALIST") {
      label = "Chuyên viên";
      icon = <User className="h-3.5 w-3.5 text-blue-600" />;
      style = "bg-blue-50 text-blue-700 border-blue-200";
    } else if (roleCode === "CLERK") {
      label = "Văn thư";
      icon = <FileText className="h-3.5 w-3.5 text-amber-600" />;
      style = "bg-amber-50 text-amber-700 border-amber-200";
    } else if (roleCode === "CITIZEN") {
      label = "Người dân";
      icon = <Users className="h-3.5 w-3.5 text-teal-600" />;
      style = "bg-teal-50 text-teal-700 border-teal-200";
    }

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-2xs ${style}`}
        >
          {icon}
          {label}
        </span>
        {user.userPermissions && user.userPermissions.length > 0 && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200"
            title={`${user.userPermissions.length} quyền riêng được cấp trực tiếp`}
          >
            <Sparkles className="h-2.5 w-2.5" />+{user.userPermissions.length} quyền riêng
          </span>
        )}
      </div>
    );
  }

  // Định nghĩa các cột hiển thị theo chuẩn Ảnh 2
  const columns: ColumnDef<UserItem, unknown>[] = [
    {
      accessorKey: "fullName",
      header: "HỌ TÊN",
      cell: ({ row }) => {
        const u = row.original;
        const initial = u.fullName ? u.fullName.trim().charAt(0).toUpperCase() : "U";
        const primary = u.positions.find((p) => p.isPrimary) || u.positions[0];
        const roleCode = primary?.roles?.[0]?.role?.code || "SPECIALIST";
        const colors = AVATAR_COLORS[roleCode] || { bg: "bg-indigo-100", text: "text-indigo-700" };

        return (
          <div className="flex items-center gap-3.5 py-1">
            <div
              className={`h-9 w-9 rounded-full ${colors.bg} ${colors.text} font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs`}
            >
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 hover:text-indigo-600 transition-colors">
                  {u.fullName}
                </span>
                {!u.isActive && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-100 text-rose-700 font-medium">
                    Đã khóa
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 block font-mono">
                ID: #{u.employeeCode}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "TÊN ĐĂNG NHẬP",
      cell: ({ row }) => {
        const u = row.original;
        const username = u.email.includes("@") ? u.email.split("@")[0] : u.employeeCode.toLowerCase();
        return (
          <div>
            <span className="text-xs font-mono text-slate-700 block">{username}</span>
            <span className="text-[11px] text-slate-400 block">{u.email}</span>
          </div>
        );
      },
    },
    {
      id: "role",
      header: "VAI TRÒ",
      cell: ({ row }) => getRoleBadge(row.original),
    },
    {
      id: "actions",
      header: () => <span className="text-right block pr-2">THAO TÁC</span>,
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5 pr-2">
            {/* 1. NÚT PHÂN QUYỀN TRỰC TIẾP CHO TÀI KHOẢN (Icon User & Shield) */}
            <button
              onClick={() => handleOpenPermissions(u)}
              title="Phân quyền chi tiết cho tài khoản này"
              className="p-1.5 rounded text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <KeyRound className="h-4 w-4" />
            </button>

            {/* 2. NÚT SỬA THÔNG TIN TÀI KHOẢN (Icon Pencil) */}
            <button
              onClick={() => handleOpenEdit(u)}
              title="Chỉnh sửa thông tin tài khoản"
              className="p-1.5 rounded text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Pencil className="h-4 w-4" />
            </button>

            {/* 3. NÚT KHÓA / XÓA TÀI KHOẢN (Icon Trash) */}
            <button
              onClick={() => handleOpenDelete(u)}
              title="Khóa hoặc xóa tài khoản"
              className="p-1.5 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  // Lọc danh sách permissions trong Drawer Phân quyền
  const filteredPermissionsByModule = useMemo(() => {
    if (!userPermDetail) return {};

    const q = permSearch.toLowerCase().trim();
    const result: Record<string, PermissionItem[]> = {};

    userPermDetail.allPermissions.forEach((p) => {
      const isInherited = userPermDetail.inheritedPermissionIds.includes(p.id);
      const isDirect = directPermsMap.has(p.id);

      // Bộ lọc trạng thái
      if (permFilter === "DIRECT" && !isDirect) return;
      if (permFilter === "INHERITED" && !isInherited) return;

      // Tìm kiếm từ khóa
      if (q) {
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = p.code.toLowerCase().includes(q);
        const matchModule = (MODULE_NAMES[p.module] || p.module).toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchModule) return;
      }

      if (!result[p.module]) {
        result[p.module] = [];
      }
      result[p.module].push(p);
    });

    return result;
  }, [userPermDetail, permSearch, permFilter, directPermsMap]);

  // Nhóm permissions theo module cho Tab Role Matrix
  const matrixPermsByModule = useMemo(() => {
    const result: Record<string, PermissionItem[]> = {};
    matrixPerms.forEach((p) => {
      if (!result[p.module]) {
        result[p.module] = [];
      }
      result[p.module].push(p);
    });
    return result;
  }, [matrixPerms]);

  const currentSelectedRole = matrixRoles.find((r) => r.id === selectedRoleId);

  return (
    <div className="space-y-4">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500 mb-1">
            Quản trị hệ thống &gt; <span className="text-slate-800 font-medium">Phân quyền người dùng</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Phân quyền người dùng
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              DB Connected
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản trị tài khoản & phân quyền tập trung: Phân quyền theo 4 vai trò chính (Quản trị viên, Lãnh đạo, Chuyên viên, Người dân) và Phân quyền trực tiếp cho từng Tài khoản cá nhân.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "ACCOUNTS" ? (
            <Button
              onClick={() => setIsAddOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm font-medium"
            >
              <UserPlus className="h-4 w-4" />
              Thêm tài khoản mới
            </Button>
          ) : (
            <Button
              onClick={handleSaveRoleMatrix}
              isLoading={isSavingMatrix}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm font-medium"
            >
              <Save className="h-4 w-4" />
              Lưu thay đổi phân quyền
            </Button>
          )}
        </div>
      </div>

      {/* ── NAVIGATION TABS: CHUYỂN ĐỔI GIỮA PHÂN QUYỀN TÀI KHOẢN & VAI TRÒ ─── */}
      <div className="flex items-center border-b border-slate-200 space-x-6 text-sm">
        <button
          onClick={() => {
            setActiveTab("ACCOUNTS");
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.delete("tab");
              window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
            }
          }}
          className={`flex items-center gap-2 pb-2.5 border-b-2 font-semibold transition-colors cursor-pointer ${
            activeTab === "ACCOUNTS"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <User className="h-4 w-4" />
          <span>Phân quyền theo Tài khoản</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-700 font-mono">
            {total}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab("ROLES");
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.set("tab", "roles");
              window.history.replaceState({}, "", url.pathname + url.search);
            }
            if (matrixRoles.length === 0) {
              fetchRoleMatrix();
            }
          }}
          className={`flex items-center gap-2 pb-2.5 border-b-2 font-semibold transition-colors cursor-pointer ${
            activeTab === "ROLES"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Phân quyền theo Vai trò (Role Matrix)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-700 font-mono">
            {matrixRoles.length > 0 ? matrixRoles.length : 4} vai trò
          </span>
        </button>
      </div>

      {/* ── TAB 1: PHÂN QUYỀN THEO TÀI KHOẢN (DATA TABLE) ───────────────── */}
      {activeTab === "ACCOUNTS" && (
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
          searchPlaceholder="Tìm kiếm theo họ tên, email, tên đăng nhập, mã nhân viên..."
        />
      )}

      {/* ── TAB 2: PHÂN QUYỀN THEO VAI TRÒ (ROLE MATRIX) ─────────────────── */}
      {activeTab === "ROLES" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Cột trái: Danh sách vai trò */}
          <div className="bg-white rounded border border-slate-200 p-3 space-y-1 shadow-2xs">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 py-1 block">
              Danh sách Vai trò
            </span>
            {matrixRoles.map((r) => {
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
                  <span
                    className={`text-[11px] mt-0.5 ${
                      isSelected ? "text-indigo-100" : "text-slate-400"
                    }`}
                  >
                    {r.description || `${r.permissions.length} quyền được gán`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Cột phải: Ma trận checkbox phân theo từng module */}
          <div className="lg:col-span-3 bg-white rounded border border-slate-200 p-6 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Quyền hạn cho vai trò:{" "}
                  <span className="text-indigo-600">{currentSelectedRole?.name || "..."}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đã chọn {selectedRolePermIds.size} / {matrixPerms.length} quyền hệ thống
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAllMatrixPerms}
                  className="text-xs h-8"
                >
                  Chọn tất cả
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearAllMatrixPerms}
                  className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  Bỏ chọn tất cả
                </Button>
              </div>
            </div>

            {isLoadingMatrix ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Đang tải ma trận phân quyền vai trò...
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(matrixPermsByModule).map(([mod, perms]) => (
                  <div key={mod} className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide bg-slate-100 px-3 py-1.5 rounded flex items-center justify-between">
                      <span>{MODULE_NAMES[mod] || mod}</span>
                      <span className="text-[10px] font-normal text-slate-500">
                        {perms.length} quyền
                      </span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                      {perms.map((p) => {
                        const isChecked = selectedRolePermIds.has(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleToggleRolePerm(p.id)}
                            className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer select-none transition-colors ${
                              isChecked
                                ? "bg-indigo-50/60 border-indigo-200 text-indigo-950 font-medium"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="mt-0.5 text-indigo-600 shrink-0">
                              {isChecked ? (
                                <CheckSquare className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <span className="text-xs font-semibold block">{p.name}</span>
                              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                {p.code}
                              </span>
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
      )}

      {/* ── DRAWER: PHÂN QUYỀN CHI TIẾT CHO TỪNG TÀI KHOẢN (USER-LEVEL) ─────── */}
      <Drawer
        isOpen={isPermDrawerOpen}
        onClose={() => setIsPermDrawerOpen(false)}
        title={`Phân quyền tài khoản: ${selectedUser?.fullName}`}
        description={`Mã: ${selectedUser?.employeeCode} • ${selectedUser?.email}`}
        width="xl"
      >
        {isLoadingPerms ? (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-16 bg-slate-100 rounded-lg border border-slate-200" />
            <div className="h-10 bg-slate-100 rounded border border-slate-200" />
            <div className="space-y-3 pt-2">
              <div className="h-24 bg-slate-100 rounded-lg border border-slate-200" />
              <div className="h-24 bg-slate-100 rounded-lg border border-slate-200" />
              <div className="h-24 bg-slate-100 rounded-lg border border-slate-200" />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Hộp tóm tắt vai trò và quyền */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">Vai trò chính:</span>
                    {userPermDetail?.roles.map((r, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200"
                      >
                        {r.name} ({r.code})
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Được kế thừa:{" "}
                    <strong className="text-slate-700">
                      {userPermDetail?.inheritedPermissionIds.length || 0}
                    </strong>{" "}
                    quyền • Được cấp riêng:{" "}
                    <strong className="text-indigo-600">{directPermsMap.size}</strong> quyền
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSelectAllPerms}
                    className="text-xs h-8"
                  >
                    Cấp tất cả còn thiếu
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearDirectPerms}
                    className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  >
                    Xóa quyền riêng
                  </Button>
                </div>
              </div>
            </div>

            {/* Thanh công cụ tìm kiếm và lọc */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="Lọc quyền theo tên hoặc mã chức năng..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setPermFilter("ALL")}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    permFilter === "ALL"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Tất cả ({userPermDetail?.allPermissions.length || 0})
                </button>
                <button
                  onClick={() => setPermFilter("DIRECT")}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    permFilter === "DIRECT"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Cấp riêng ({directPermsMap.size})
                </button>
                <button
                  onClick={() => setPermFilter("INHERITED")}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    permFilter === "INHERITED"
                      ? "bg-purple-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Từ vai trò ({userPermDetail?.inheritedPermissionIds.length || 0})
                </button>
              </div>
            </div>

            {/* Danh sách ma trận quyền phân theo Module */}
            <div className="space-y-6 max-h-[55vh] overflow-y-auto pr-1">
              {Object.keys(filteredPermissionsByModule).length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">
                  Không tìm thấy quyền hạn phù hợp với điều kiện lọc.
                </p>
              ) : (
                Object.entries(filteredPermissionsByModule).map(([mod, perms]) => (
                  <div key={mod} className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide bg-slate-100 px-3 py-1.5 rounded flex items-center justify-between">
                      <span>{MODULE_NAMES[mod] || mod}</span>
                      <span className="text-[10px] font-normal text-slate-500">
                        {perms.length} quyền
                      </span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                      {perms.map((p) => {
                        const isInherited = userPermDetail?.inheritedPermissionIds.includes(p.id);
                        const isDirect = directPermsMap.has(p.id);
                        const isChecked = isInherited || isDirect;
                        const currentScope = directPermsMap.get(p.id) || "OWN";

                        return (
                          <div
                            key={p.id}
                            className={`p-3 rounded border transition-all ${
                              isDirect
                                ? "bg-indigo-50/70 border-indigo-300 shadow-2xs"
                                : isInherited
                                ? "bg-slate-50/80 border-slate-200"
                                : "bg-white border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div
                                onClick={() => {
                                  // Nếu quyền đã có trong vai trò, không bắt buộc gán thêm trừ khi muốn override
                                  handleToggleDirectPerm(p.id);
                                }}
                                className="flex items-start gap-2.5 cursor-pointer flex-1 select-none"
                              >
                                <div className="mt-0.5 shrink-0">
                                  {isDirect ? (
                                    <CheckSquare className="h-4 w-4 text-indigo-600" />
                                  ) : isInherited ? (
                                    <CheckSquare className="h-4 w-4 text-purple-600" />
                                  ) : (
                                    <Square className="h-4 w-4 text-slate-400" />
                                  )}
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-slate-900 block">
                                    {p.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                    {p.code}
                                  </span>
                                </div>
                              </div>

                              {/* Nhãn nguồn gốc quyền */}
                              <div className="shrink-0 flex flex-col items-end gap-1">
                                {isInherited && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200"
                                    title="Quyền này được kế thừa từ Vai trò của người dùng"
                                  >
                                    Từ vai trò
                                  </span>
                                )}
                                {isDirect && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1"
                                    title="Quyền này được cấp riêng trực tiếp cho tài khoản"
                                  >
                                    <Sparkles className="h-2.5 w-2.5" />
                                    Cấp riêng
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Dropdown chọn DataScope nếu quyền này được cấp riêng */}
                            {isDirect && (
                              <div className="mt-2.5 pt-2 border-t border-indigo-100 flex items-center justify-between text-xs">
                                <span className="text-[11px] text-slate-500 font-medium">
                                  Phạm vi dữ liệu:
                                </span>
                                <select
                                  value={currentScope}
                                  onChange={(e) => handleChangeDirectScope(p.id, e.target.value)}
                                  className="text-[11px] py-1 px-2 bg-white border border-indigo-200 rounded font-medium text-indigo-900 focus:outline-none"
                                >
                                  <option value="ALL">ALL — Toàn cơ quan</option>
                                  <option value="UNIT_TREE">UNIT_TREE — Cây đơn vị</option>
                                  <option value="UNIT">UNIT — Phòng ban</option>
                                  <option value="OWN">OWN — Cá nhân tạo/giao</option>
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer hành động của Drawer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Đã chọn <strong className="text-indigo-600">{directPermsMap.size}</strong> quyền riêng
                cấp cho tài khoản này.
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsPermDrawerOpen(false)}>
                  Hủy
                </Button>
                <Button
                  onClick={handleSaveUserPermissions}
                  isLoading={isSavingPerms}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm"
                >
                  <Save className="h-4 w-4" />
                  Lưu thay đổi phân quyền
                </Button>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── DRAWER: THÊM TÀI KHOẢN MỚI ───────────────────────────────────── */}
      <Drawer
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Thêm tài khoản mới"
        description="Khởi tạo tài khoản và phân quyền ban đầu cho cán bộ"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mã cán bộ / Tên đăng nhập *
            </label>
            <input
              type="text"
              required
              value={addForm.employeeCode}
              onChange={(e) =>
                setAddForm({ ...addForm, employeeCode: e.target.value.toUpperCase() })
              }
              placeholder="VD: NV009, GD002, admin02"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên *</label>
            <input
              type="text"
              required
              value={addForm.fullName}
              onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
              placeholder="VD: Nguyễn Văn Hoàng"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Địa chỉ Email *
            </label>
            <input
              type="email"
              required
              value={addForm.email}
              onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
              placeholder="VD: hoang.nv@eoffice.local"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Số điện thoại liên hệ
            </label>
            <input
              type="text"
              value={addForm.phone}
              onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
              placeholder="VD: 0912345678"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu khởi tạo
            </label>
            <input
              type="text"
              value={addForm.password}
              onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none font-mono"
            />
          </div>

          <div className="pt-2 border-t border-slate-200">
            <span className="text-xs font-bold text-slate-800 uppercase block mb-3">
              Gán chức vụ & Vai trò ban đầu
            </span>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Đơn vị / Phòng ban
                </label>
                <select
                  value={addForm.unitId}
                  onChange={(e) => setAddForm({ ...addForm, unitId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Chức danh</label>
                <select
                  value={addForm.positionId}
                  onChange={(e) => setAddForm({ ...addForm, positionId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Vai trò hệ thống (Role)
                </label>
                <select
                  value={addForm.roleId}
                  onChange={(e) => setAddForm({ ...addForm, roleId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phạm vi dữ liệu mặc định (Data Scope)
                </label>
                <select
                  value={addForm.dataScope}
                  onChange={(e) => setAddForm({ ...addForm, dataScope: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  <option value="ALL">ALL — Toàn cơ quan</option>
                  <option value="UNIT_TREE">UNIT_TREE — Đơn vị mình và đơn vị con</option>
                  <option value="UNIT">UNIT — Trong phạm vi phòng ban mình</option>
                  <option value="OWN">OWN — Chỉ các văn bản do cá nhân xử lý/tạo</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              isLoading={isSubmittingAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Tạo tài khoản
            </Button>
          </div>
        </form>
      </Drawer>

      {/* ── DRAWER: CHỈNH SỬA TÀI KHOẢN ──────────────────────────────────── */}
      <Drawer
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Chỉnh sửa: ${selectedUser?.fullName}`}
        description={`Cập nhật thông tin cán bộ và cơ cấu chức vụ`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên *</label>
            <input
              type="text"
              required
              value={editForm.fullName}
              onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
            <input
              type="email"
              required
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại</label>
            <input
              type="text"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Đặt lại mật khẩu mới
            </label>
            <input
              type="password"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              placeholder="Để trống nếu không muốn đổi mật khẩu"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Trạng thái tài khoản
            </label>
            <select
              value={editForm.isActive ? "true" : "false"}
              onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === "true" })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
            >
              <option value="true">Đang hoạt động</option>
              <option value="false">Đã khóa tài khoản</option>
            </select>
          </div>

          <div className="pt-2 border-t border-slate-200">
            <span className="text-xs font-bold text-slate-800 uppercase block mb-3">
              Chức vụ & Vai trò chính
            </span>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Đơn vị / Phòng ban
                </label>
                <select
                  value={editForm.unitId}
                  onChange={(e) => setEditForm({ ...editForm, unitId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Chức danh</label>
                <select
                  value={editForm.positionId}
                  onChange={(e) => setEditForm({ ...editForm, positionId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Vai trò hệ thống
                </label>
                <select
                  value={editForm.roleId}
                  onChange={(e) => setEditForm({ ...editForm, roleId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phạm vi dữ liệu (Data Scope)
                </label>
                <select
                  value={editForm.dataScope}
                  onChange={(e) => setEditForm({ ...editForm, dataScope: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  <option value="ALL">ALL — Toàn cơ quan</option>
                  <option value="UNIT_TREE">UNIT_TREE — Đơn vị mình và đơn vị con</option>
                  <option value="UNIT">UNIT — Trong phạm vi phòng ban mình</option>
                  <option value="OWN">OWN — Chỉ văn bản do mình tạo/giao</option>
                </select>
              </div>
            </div>
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

      {/* ── DIALOG XÁC NHẬN KHÓA / XÓA TÀI KHOẢN ─────────────────────────── */}
      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Khóa hoặc xóa tài khoản người dùng"
        description={`Bạn có chắc chắn muốn xóa hoặc khóa tài khoản của "${selectedUser?.fullName}" (${selectedUser?.employeeCode})? Nếu tài khoản đã có văn bản liên kết, hệ thống sẽ tự động khóa tài khoản để bảo toàn dữ liệu lịch sử.`}
        confirmText="Xác nhận"
        cancelText="Đóng"
        variant="danger"
      />
    </div>
  );
}
