// src/components/layout/breadcrumbs.tsx
// Breadcrumbs định hướng tự động theo đường dẫn URL

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  documents: "Văn bản",
  incoming: "Văn bản đến",
  outgoing: "Văn bản đi",
  archives: "Hồ sơ lưu trữ",
  catalogs: "Danh mục",
  books: "Sổ văn bản",
  admin: "Quản trị hệ thống",
  users: "Phân quyền người dùng",
  units: "Đơn vị & Phòng ban",
  positions: "Chức danh",
  roles: "Phân quyền người dùng",
  "document-types": "Loại hồ sơ & Độ khẩn",
  "audit-logs": "Nhật ký hệ thống",
  profile: "Cá nhân",
  "change-password": "Đổi mật khẩu",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 select-none">
      <Link href="/documents/incoming" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
        <Home className="h-3.5 w-3.5" />
      </Link>

      {segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;
        const label = ROUTE_LABELS[segment] || segment;

        return (
          <React.Fragment key={href}>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            {isLast ? (
              <span className="font-semibold text-slate-800">{label}</span>
            ) : (
              <Link href={href} className="hover:text-indigo-600 transition-colors">
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
