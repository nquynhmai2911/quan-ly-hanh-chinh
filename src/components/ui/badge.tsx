// src/components/ui/badge.tsx
// Badge hiển thị Trạng thái văn bản, Độ khẩn, Độ mật chuẩn Enterprise

import React from "react";
import { cn } from "@/lib/utils";
import { DocumentStatus, UrgencyLevel, SecurityLevel } from "@prisma/client";
import { Flame, ShieldAlert } from "lucide-react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "outline";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-slate-100 text-slate-800 border-slate-200",
    secondary: "bg-slate-200 text-slate-700 border-slate-300",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
    outline: "border-slate-300 text-slate-700 bg-transparent",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border select-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Tên tiếng Việt và kiểu dáng trạng thái văn bản */
const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: "Dự thảo",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  SUBMITTED: {
    label: "Chờ tiếp nhận",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  RECEIVED: {
    label: "Đã vào sổ",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  PENDING_LEADER: {
    label: "Chờ xin ý kiến",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  DISTRIBUTED: {
    label: "Đã bút phê",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  PROCESSING: {
    label: "Đang xử lý",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  PENDING_REVIEW: {
    label: "Chờ duyệt",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  PENDING_APPROVAL: {
    label: "Chờ ký duyệt",
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
  APPROVED: {
    label: "Đã ký duyệt",
    className: "bg-teal-50 text-teal-700 border-teal-200",
  },
  NUMBERED: {
    label: "Đã cấp số",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  ISSUED: {
    label: "Đã ban hành",
    className:
      "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold",
  },
  COMPLETED: {
    label: "Hoàn thành",
    className: "bg-green-100 text-green-800 border-green-300 font-semibold",
  },
  RETURNED: {
    label: "Bị trả lại",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  RECALLED: {
    label: "Đã thu hồi",
    className: "bg-rose-50 text-rose-700 border-rose-200 font-semibold",
  },
  REPLACED: {
    label: "Bị thay thế",
    className: "bg-zinc-100 text-zinc-700 border-zinc-200 line-through",
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "bg-red-50 text-red-700 border-red-200 line-through",
  },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    className: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border select-none",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

/** Badge hiển thị Độ khẩn */
export function UrgencyBadge({ level }: { level: UrgencyLevel }) {
  if (level === "FIRE") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800 border border-rose-300 animate-pulse">
        <Flame className="h-3 w-3" /> Hỏa tốc
      </span>
    );
  }
  if (level === "URGENT") {
    return (
      <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 border border-amber-300">
        Khẩn
      </span>
    );
  }
  return null;
}

/** Badge hiển thị Độ mật */
export function SecurityBadge({ level }: { level: SecurityLevel }) {
  if (level === "TOP_SECRET") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-red-900 px-2 py-0.5 text-xs font-bold text-white border border-red-950">
        <ShieldAlert className="h-3 w-3" /> Tuyệt mật
      </span>
    );
  }
  if (level === "SECRET") {
    return (
      <span className="inline-flex items-center rounded bg-rose-800 px-2 py-0.5 text-xs font-semibold text-white border border-rose-900">
        Tối mật
      </span>
    );
  }
  if (level === "CONFIDENTIAL") {
    return (
      <span className="inline-flex items-center rounded bg-orange-700 px-2 py-0.5 text-xs font-semibold text-white border border-orange-800">
        Mật
      </span>
    );
  }
  return null;
}
