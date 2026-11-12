// src/lib/constants.ts
// Hằng số dùng chung toàn hệ thống

// ── Phân quyền ──────────────────────────────────────────────────────────────

/** Vai trò mặc định hệ thống */
export const SystemRoles = {
  ADMIN: "ADMIN",
  LEADER: "LEADER",
  SPECIALIST: "SPECIALIST",
  CITIZEN: "CITIZEN",
} as const;

export type SystemRoleCode = (typeof SystemRoles)[keyof typeof SystemRoles];

/** Danh sách quyền (permission code) */
export const Permissions = {
  // ── Văn bản đến ──
  INCOMING_VIEW: "doc.incoming.view",
  INCOMING_CREATE: "doc.incoming.create",
  INCOMING_REGISTER: "doc.incoming.register",
  INCOMING_FORWARD: "doc.incoming.forward",
  INCOMING_ANNOTATE: "doc.incoming.annotate",
  INCOMING_ASSIGN: "doc.incoming.assign",
  INCOMING_PROCESS: "doc.incoming.process",
  INCOMING_COMPLETE: "doc.incoming.complete",

  // ── Văn bản đi ──
  OUTGOING_VIEW: "doc.outgoing.view",
  OUTGOING_CREATE: "doc.outgoing.create",
  OUTGOING_REVIEW: "doc.outgoing.review",
  OUTGOING_APPROVE: "doc.outgoing.approve",
  OUTGOING_SIGN: "doc.outgoing.sign",
  OUTGOING_NUMBER: "doc.outgoing.number",
  OUTGOING_ISSUE: "doc.outgoing.issue",
  OUTGOING_RECALL: "doc.outgoing.recall",
  OUTGOING_REPLACE: "doc.outgoing.replace",
  OUTGOING_CANCEL: "doc.outgoing.cancel",

  // ── Danh mục ──
  CATALOG_VIEW: "catalog.view",
  CATALOG_MANAGE: "catalog.manage",

  // ── Quản trị ──
  ADMIN_USER_MANAGE: "admin.user.manage",
  ADMIN_ROLE_MANAGE: "admin.role.manage",
  ADMIN_UNIT_MANAGE: "admin.unit.manage",
  ADMIN_SYSTEM: "admin.system",

  // ── Hồ sơ lưu trữ ──
  ARCHIVE_VIEW: "archive.view",
  ARCHIVE_MANAGE: "archive.manage",

  // ── Thông báo ──
  NOTIFICATION_VIEW: "notification.view",
} as const;

export type PermissionCode = (typeof Permissions)[keyof typeof Permissions];

// ── Upload file ─────────────────────────────────────────────────────────────

/** Định dạng file được phép upload */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
] as const;

/** Phần mở rộng cho phép */
export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
] as const;

/** Dung lượng tối đa mặc định (bytes) */
export const MAX_FILE_SIZE_BYTES =
  (parseInt(process.env.MAX_FILE_SIZE_MB || "25", 10)) * 1024 * 1024;

// ── Giao diện ───────────────────────────────────────────────────────────────

/** Số dòng mặc định mỗi trang bảng */
export const DEFAULT_PAGE_SIZE = 20;

/** Các lựa chọn page size */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** Thời gian debounce tìm kiếm (ms) */
export const SEARCH_DEBOUNCE_MS = 300;

/** Cache danh mục staleTime */
export const CATALOG_STALE_TIME = Infinity;

/** Auth context cache TTL (seconds) */
export const AUTH_CONTEXT_CACHE_TTL = 60;

// ── Nhãn tiếng Việt ─────────────────────────────────────────────────────────

/** Nhãn độ khẩn */
export const URGENCY_LABELS: Record<string, string> = {
  NORMAL: "Thường",
  URGENT: "Khẩn",
  FIRE: "Hỏa tốc",
};

/** Nhãn độ mật */
export const SECURITY_LABELS: Record<string, string> = {
  NORMAL: "Thường",
  CONFIDENTIAL: "Mật",
  SECRET: "Tối mật",
  TOP_SECRET: "Tuyệt mật",
};

/** Nhãn loại sổ */
export const BOOK_TYPE_LABELS: Record<string, string> = {
  INCOMING: "Sổ văn bản đến",
  OUTGOING: "Sổ văn bản đi",
};

/** Nhãn Data Scope */
export const DATA_SCOPE_LABELS: Record<string, string> = {
  ALL: "Toàn cơ quan",
  UNIT_TREE: "Đơn vị và đơn vị con",
  UNIT: "Chỉ đơn vị mình",
  OWN: "Cá nhân",
};
