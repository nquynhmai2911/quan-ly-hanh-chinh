// src/lib/query-keys.ts
// TanStack Query keys — quản lý tập trung, dùng cho cache invalidation

export const queryKeys = {
  // ── Auth ───────────────────────────────────────────────────────────────
  auth: {
    session: ["auth", "session"] as const,
    context: (userId: string) => ["auth", "context", userId] as const,
  },

  // ── Tổ chức ────────────────────────────────────────────────────────────
  units: {
    all: ["units"] as const,
    list: (params?: Record<string, unknown>) =>
      ["units", "list", params] as const,
    tree: () => ["units", "tree"] as const,
    detail: (id: string) => ["units", "detail", id] as const,
  },

  positions: {
    all: ["positions"] as const,
    list: (params?: Record<string, unknown>) =>
      ["positions", "list", params] as const,
  },

  // ── Người dùng ─────────────────────────────────────────────────────────
  users: {
    all: ["users"] as const,
    list: (params?: Record<string, unknown>) =>
      ["users", "list", params] as const,
    detail: (id: string) => ["users", "detail", id] as const,
  },

  // ── Phân quyền ─────────────────────────────────────────────────────────
  roles: {
    all: ["roles"] as const,
    list: (params?: Record<string, unknown>) =>
      ["roles", "list", params] as const,
    detail: (id: string) => ["roles", "detail", id] as const,
    permissions: (roleId: string) =>
      ["roles", "permissions", roleId] as const,
  },

  permissions: {
    all: ["permissions"] as const,
    byModule: (module: string) => ["permissions", "module", module] as const,
  },

  // ── Danh mục ───────────────────────────────────────────────────────────
  catalogs: {
    documentTypes: {
      all: ["catalogs", "documentTypes"] as const,
      list: (params?: Record<string, unknown>) =>
        ["catalogs", "documentTypes", "list", params] as const,
    },
    fields: {
      all: ["catalogs", "fields"] as const,
    },
    externalOrgs: {
      all: ["catalogs", "externalOrgs"] as const,
      list: (params?: Record<string, unknown>) =>
        ["catalogs", "externalOrgs", "list", params] as const,
    },
    urgencyLevels: ["catalogs", "urgencyLevels"] as const,
    securityLevels: ["catalogs", "securityLevels"] as const,
  },

  // ── Sổ văn bản ─────────────────────────────────────────────────────────
  documentBooks: {
    all: ["documentBooks"] as const,
    list: (params?: Record<string, unknown>) =>
      ["documentBooks", "list", params] as const,
    detail: (id: string) => ["documentBooks", "detail", id] as const,
  },

  // ── Văn bản đến (Phase 3) ──────────────────────────────────────────────
  incomingDocuments: {
    all: ["incomingDocuments"] as const,
    list: (params?: Record<string, unknown>) =>
      ["incomingDocuments", "list", params] as const,
    detail: (id: string) => ["incomingDocuments", "detail", id] as const,
    handlers: (docId: string) =>
      ["incomingDocuments", "handlers", docId] as const,
  },

  // ── Văn bản đi (Phase 3) ──────────────────────────────────────────────
  outgoingDocuments: {
    all: ["outgoingDocuments"] as const,
    list: (params?: Record<string, unknown>) =>
      ["outgoingDocuments", "list", params] as const,
    detail: (id: string) => ["outgoingDocuments", "detail", id] as const,
    approvals: (docId: string) =>
      ["outgoingDocuments", "approvals", docId] as const,
  },

  // ── Thông báo ──────────────────────────────────────────────────────────
  notifications: {
    all: ["notifications"] as const,
    unreadCount: ["notifications", "unreadCount"] as const,
    list: (params?: Record<string, unknown>) =>
      ["notifications", "list", params] as const,
  },

  // ── Hồ sơ lưu trữ (Phase 4) ───────────────────────────────────────────
  archives: {
    all: ["archives"] as const,
    list: (params?: Record<string, unknown>) =>
      ["archives", "list", params] as const,
    detail: (id: string) => ["archives", "detail", id] as const,
  },

  // ── Dashboard (Phase 5) ────────────────────────────────────────────────
  dashboard: {
    summary: ["dashboard", "summary"] as const,
    pendingDocuments: ["dashboard", "pending"] as const,
    overdueDocuments: ["dashboard", "overdue"] as const,
  },
} as const;
