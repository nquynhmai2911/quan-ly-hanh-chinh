// src/types/auth.ts
// Kiểu dữ liệu cho Auth Context — dùng ở Service layer

import type { DataScope } from "@prisma/client";

/** Thông tin chức vụ đang giữ */
export interface ActivePosition {
  userPositionId: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  positionId: string;
  positionName: string;
  isPrimary: boolean;
}

/** Quyền đã gom từ tất cả vai trò của các chức vụ đang hoạt động */
export interface ResolvedPermission {
  code: string;
  dataScope: DataScope;
}

/** Auth Context — tải từ DB, cache ngắn (60s) */
export interface AuthContext {
  userId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
  /** Danh sách chức vụ đang giữ (endedAt = null) */
  positions: ActivePosition[];
  /** Chức vụ chính (isPrimary = true) */
  primaryPosition: ActivePosition | null;
  /** Quyền đã gom (permission code → data scope tốt nhất) */
  permissions: Map<string, DataScope>;
  /** Danh sách mã vai trò (role code) */
  roleCodes: string[];
}

/** Payload lưu trong JWT (Auth.js session) — gọn, chỉ chứa id + hiển thị */
export interface SessionUser {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}
