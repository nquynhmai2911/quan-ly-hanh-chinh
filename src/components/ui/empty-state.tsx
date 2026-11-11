// src/components/ui/empty-state.tsx
// Trạng thái trống (không có dữ liệu) trực quan, có nút hành động

import React from "react";
import { FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "Không tìm thấy dữ liệu",
  description = "Hiện tại chưa có bản ghi nào hoặc không khớp với điều kiện tìm kiếm.",
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center rounded border border-dashed border-slate-200 bg-white/50 my-4",
        className
      )}
    >
      <div className="rounded-full bg-slate-100 p-3 text-slate-500 mb-3">
        {icon || <FolderOpen className="h-8 w-8 stroke-[1.5]" />}
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mt-1 mb-4">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
