// src/app/(dashboard)/admin/users/page.tsx
// Màn hình Quản lý Người dùng & Nhân sự (Admin)

"use client";

import React, { useState, useEffect } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Shield, Building, UserCheck } from "lucide-react";
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
}

export default function AdminUsersPage() {
  const [data, setData] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Drawer states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Form state thêm user
  const [formData, setFormData] = useState({
    employeeCode: "",
    fullName: "",
    email: "",
    phone: "",
    password: "User@123",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Danh mục để gán chức vụ
  const [units, setUnits] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [positions, setPositions] = useState<Array<{ id: string; name: string }>>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [assignForm, setAssignForm] = useState({
    unitId: "",
    positionId: "",
    roleId: "",
    dataScope: "OWN",
  });

  async function fetchUsers() {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/users?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setTotal(json.pagination?.total || 0);
      } else {
        toast.error(json.error?.message || "Không thể tải danh sách người dùng.");
      }
    } catch {
      toast.error("Lỗi kết nối khi tải danh sách người dùng.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize, search]);

  // Nạp danh mục khi mở drawer gán chức vụ
  async function loadCatalogsForAssign(user: UserItem) {
    setSelectedUser(user);
    setIsAssignOpen(true);
    try {
      const [resUnits, resPositions, resRoles] = await Promise.all([
        fetch("/api/admin/units").then((r) => r.json()),
        fetch("/api/admin/positions").then((r) => r.json()),
        fetch("/api/admin/roles").then((r) => r.json()),
      ]);

      if (resUnits.success) setUnits(resUnits.data);
      if (resPositions.success) setPositions(resPositions.data);
      if (resRoles.success) setRoles(resRoles.data.roles);

      if (resUnits.data?.[0]) setAssignForm((prev) => ({ ...prev, unitId: resUnits.data[0].id }));
      if (resPositions.data?.[0]) setAssignForm((prev) => ({ ...prev, positionId: resPositions.data[0].id }));
      if (resRoles.data?.roles?.[0]) setAssignForm((prev) => ({ ...prev, roleId: resRoles.data.roles[0].id }));
    } catch {
      toast.error("Không thể tải danh mục phòng ban và chức danh.");
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Tạo người dùng thất bại.");
        return;
      }
      toast.success("Tạo tài khoản thành công! Mật khẩu mặc định: " + formData.password);
      setIsAddOpen(false);
      setFormData({ employeeCode: "", fullName: "", email: "", phone: "", password: "User@123" });
      fetchUsers();
    } catch {
      toast.error("Lỗi khi gửi yêu cầu.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignPosition(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      setIsSubmitting(true);
      const res = await fetch(`/api/admin/users/${selectedUser.id}/position`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Gán chức vụ thất bại.");
        return;
      }
      toast.success("Gán chức vụ và vai trò thành công! Quyền có hiệu lực ngay.");
      setIsAssignOpen(false);
      fetchUsers();
    } catch {
      toast.error("Lỗi khi gán chức vụ.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: ColumnDef<UserItem, any>[] = [
    {
      accessorKey: "employeeCode",
      header: "Mã NV",
      cell: ({ row }) => <span className="font-mono text-xs font-semibold text-slate-800">{row.original.employeeCode}</span>,
    },
    {
      accessorKey: "fullName",
      header: "Họ và tên",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-slate-900">{row.original.fullName}</p>
          <p className="text-xs text-slate-500">{row.original.email}</p>
        </div>
      ),
    },
    {
      id: "position",
      header: "Chức vụ & Đơn vị",
      cell: ({ row }) => {
        const primary = row.original.positions.find((p) => p.isPrimary) || row.original.positions[0];
        if (!primary) {
          return <span className="text-xs text-slate-400 italic">Chưa gán chức vụ</span>;
        }
        return (
          <div className="text-xs">
            <span className="font-medium text-slate-800">{primary.position.name}</span>
            <span className="text-slate-400 mx-1">•</span>
            <span className="text-slate-600">{primary.unit.name} ({primary.unit.code})</span>
          </div>
        );
      },
    },
    {
      id: "roles",
      header: "Vai trò & Phạm vi",
      cell: ({ row }) => {
        const rolesList = row.original.positions.flatMap((p) => p.roles);
        if (rolesList.length === 0) {
          return <span className="text-xs text-slate-400 italic">Chưa phân quyền</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {rolesList.map((r, i) => (
              <Badge key={i} variant="info" className="text-[10px]">
                {r.role.name} ({r.dataScope})
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Trạng thái",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "danger"}>
          {row.original.isActive ? "Hoạt động" : "Đã khóa"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Thao tác",
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={() => loadCatalogsForAssign(row.original)}
        >
          <UserCheck className="h-3.5 w-3.5 mr-1" />
          Gán chức vụ
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Quản lý Người dùng & Nhân sự</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Danh sách tài khoản cán bộ công chức, thông tin chức vụ và vai trò quyền hạn
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-1.5 shadow-sm">
          <UserPlus className="h-4 w-4" />
          Thêm người dùng mới
        </Button>
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
        searchPlaceholder="Tìm kiếm theo họ tên, email, mã nhân viên..."
      />

      {/* Drawer: Thêm người dùng mới */}
      <Drawer
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Thêm Người dùng mới"
        description="Khởi tạo tài khoản cán bộ trong hệ thống E-Office"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mã nhân viên / Mã cán bộ *</label>
            <input
              type="text"
              required
              value={formData.employeeCode}
              onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value.toUpperCase() })}
              placeholder="VD: CV005, NV012"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên *</label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="VD: Nguyễn Văn Hoàng"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Địa chỉ Email công vụ *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="VD: hoang.nv@eoffice.local"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Số điện thoại liên hệ</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="VD: 0912345678"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu khởi tạo</label>
            <input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">Cán bộ có thể tự đổi mật khẩu sau khi đăng nhập</p>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsAddOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Tạo tài khoản
            </Button>
          </div>
        </form>
      </Drawer>

      {/* Drawer: Gán Chức vụ & Vai trò */}
      <Drawer
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        title={`Gán chức vụ cho: ${selectedUser?.fullName}`}
        description="Gán cán bộ vào đơn vị phòng ban, chức danh và vai trò hệ thống kèm Data Scope"
      >
        <form onSubmit={handleAssignPosition} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Đơn vị / Phòng ban *</label>
            <select
              required
              value={assignForm.unitId}
              onChange={(e) => setAssignForm({ ...assignForm, unitId: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Chức danh *</label>
            <select
              required
              value={assignForm.positionId}
              onChange={(e) => setAssignForm({ ...assignForm, positionId: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Vai trò hệ thống (Role) *</label>
            <select
              required
              value={assignForm.roleId}
              onChange={(e) => setAssignForm({ ...assignForm, roleId: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phạm vi dữ liệu (Data Scope) *</label>
            <select
              required
              value={assignForm.dataScope}
              onChange={(e) => setAssignForm({ ...assignForm, dataScope: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            >
              <option value="ALL">ALL — Toàn cơ quan (Toàn bộ văn bản cơ quan)</option>
              <option value="UNIT_TREE">UNIT_TREE — Đơn vị mình và các đơn vị con</option>
              <option value="UNIT">UNIT — Chỉ trong phạm vi phòng ban mình</option>
              <option value="OWN">OWN — Chỉ các văn bản do cá nhân tạo hoặc được giao</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsAssignOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Lưu phân công
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
