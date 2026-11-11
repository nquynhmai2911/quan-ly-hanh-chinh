// src/components/ui/skeleton.tsx
// Hiệu ứng tải trang khung xương Skeleton loader

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded bg-slate-200/80", className)}
      {...props}
    />
  );
}

/** Skeleton bảng dữ liệu */
export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-3 p-4">
      <div className="flex justify-between items-center pb-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="border border-slate-200 rounded overflow-hidden">
        <div className="bg-slate-100 p-3 flex gap-4 border-b border-slate-200">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="p-3.5 flex gap-4 items-center">
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton key={c} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
