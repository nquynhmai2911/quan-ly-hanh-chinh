// src/components/layout/sidebar.tsx
// Sidebar điều hướng Enterprise thu gọn được, phân nhóm menu chuẩn hành chính

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Send,
  Archive,
  BookOpen,
  Users,
  Building2,
  Briefcase,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Layers,
  LayoutDashboard,
  CheckCircle2,
  BarChart3,
  Search,
  Bell,
  History,
  UploadCloud,
  FileStack,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  userRoles?: string[];
  userPermissions?: string[];
}

export function Sidebar({
  isCollapsed,
  onToggle,
  userRoles = [],
  userPermissions = [],
}: SidebarProps) {
  const pathname = usePathname();
  const [adminOpen, setAdminOpen] = useState(true);

  const isAdmin = userRoles.includes("ADMIN");

  const citizenOnly =
    userRoles.includes("CITIZEN") &&
    !userRoles.some((r) =>
      ["ADMIN", "CLERK", "LEADER", "DEPT_HEAD", "SPECIALIST"].includes(r),
    );

  const permSet = new Set(userPermissions);
  const hasPerm = (code: string) => isAdmin || permSet.has(code);

  // Quyền truy cập các mục chức năng dựa trên quyền cụ thể của tài khoản
  const canViewIncoming = isAdmin || citizenOnly || hasPerm("doc.incoming.view") || hasPerm("doc.incoming.create");
  const canViewOutgoing = !citizenOnly && (isAdmin || hasPerm("doc.outgoing.view") || hasPerm("doc.outgoing.create"));
  const canSubmitCitizen = citizenOnly || isAdmin;
  const canSearch = !citizenOnly && (isAdmin || hasPerm("doc.incoming.view") || hasPerm("doc.outgoing.view") || hasPerm("archive.view"));
  const canViewArchives = !citizenOnly && (isAdmin || hasPerm("archive.view") || hasPerm("archive.manage"));
  const canViewBooks = !citizenOnly && (isAdmin || hasPerm("catalog.view") || hasPerm("catalog.manage"));
  const canViewNotifications = true;

  const navSections = [
    {
      title: "ĐIỀU HÀNH",
      items: [
        {
          name: "Bàn làm việc & Điều hành",
          href: "/dashboard",
          icon: LayoutDashboard,
          badge: null,
          visible: true,
        },
      ],
    },
    {
      title: "QUẢN LÝ VĂN BẢN",
      items: [
        {
          name: "Văn bản đến",
          href: "/documents/incoming",
          icon: FileText,
          badge: null,
          visible: canViewIncoming,
        },
        {
          name: "Văn bản đi / Dự thảo",
          href: "/documents/outgoing",
          icon: Send,
          badge: null,
          visible: canViewOutgoing,
        },
        {
          name: "Nộp văn bản đến (Dịch vụ công)",
          href: "/citizen/submit",
          icon: UploadCloud,
          badge: null,
          visible: canSubmitCitizen,
        },
        {
          name: "Tra cứu văn bản",
          href: "/search",
          icon: Search,
          badge: null,
          visible: canSearch,
        },
      ],
    },
    {
      title: "LƯU TRỮ & THÔNG BÁO",
      items: [
        {
          name: "Hồ sơ công việc",
          href: "/archives",
          icon: Archive,
          badge: null,
          visible: canViewArchives,
        },
        {
          name: "Sổ văn bản",
          href: "/catalogs/books",
          icon: BookOpen,
          badge: null,
          visible: canViewBooks,
        },
        {
          name: "Trung tâm thông báo",
          href: "/notifications",
          icon: Bell,
          badge: null,
          visible: canViewNotifications,
        },
      ],
    },
  ];

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.visible),
    }))
    .filter((section) => section.items.length > 0);

  const adminItems = [
    { name: "Phân quyền người dùng", href: "/admin/users", icon: ShieldCheck, visible: isAdmin || hasPerm("admin.role.manage") },
    { name: "Cây Đơn vị / Phòng ban", href: "/admin/units", icon: Building2, visible: isAdmin || hasPerm("admin.unit.manage") },
    { name: "Chức danh", href: "/admin/positions", icon: Briefcase, visible: isAdmin || hasPerm("admin.system") || hasPerm("admin.unit.manage") },
    { name: "Loại hồ sơ & Độ khẩn", href: "/admin/document-types", icon: FileStack, visible: isAdmin || hasPerm("admin.system") },
    { name: "Cấu hình Sổ văn bản", href: "/admin/books", icon: BookOpen, visible: isAdmin || hasPerm("admin.system") },
    { name: "Nhật ký hệ thống", href: "/admin/audit-logs", icon: History, visible: isAdmin || hasPerm("admin.system") },
  ].filter((item) => item.visible);

  return (
    <aside
      className={cn(
        "bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-all duration-300 select-none z-30 shrink-0",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-slate-800 bg-slate-950/40">
        {!isCollapsed && (
          <Link
            href="/documents/incoming"
            className="flex items-center gap-2.5 overflow-hidden"
          >
            <div className="h-8 w-8 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-base shrink-0 shadow-md">
              EO
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white tracking-wide text-sm leading-tight">
                E-OFFICE
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Văn bản & Điều hành
              </span>
            </div>
          </Link>
        )}

        {isCollapsed && (
          <div className="mx-auto h-8 w-8 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            EO
          </div>
        )}

        <button
          onClick={onToggle}
          title={
            isCollapsed
              ? "Mở rộng sidebar (Ctrl+B)"
              : "Thu gọn sidebar (Ctrl+B)"
          }
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-auto"
        >
          {isCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-6">
        {visibleSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const isActive =
                pathname.startsWith(item.href) ||
                (item.href === "/dashboard" &&
                  ["/tasks", "/reports"].some((p) => pathname.startsWith(p)));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  title={isCollapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-colors group relative",
                    isActive
                      ? "bg-indigo-600 text-white font-semibold shadow-xs"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive
                        ? "text-white"
                        : "text-slate-400 group-hover:text-slate-200",
                    )}
                  />
                  {!isCollapsed && (
                    <span className="truncate flex-1">{item.name}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Quản trị hệ thống (Chỉ hiển thị khi có quyền quản trị) */}
        {adminItems.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-slate-800/80">
            {!isCollapsed ? (
              <button
                onClick={() => setAdminOpen(!adminOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase hover:text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3 w-3" />
                  QUẢN TRỊ HỆ THỐNG
                </span>
                {adminOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>
            ) : null}

            {(adminOpen || isCollapsed) &&
              adminItems.map((item) => {
                const isActive =
                  pathname.startsWith(item.href) ||
                  (item.href === "/admin/users" && pathname.startsWith("/admin/roles"));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    title={isCollapsed ? item.name : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-colors group relative",
                      isActive
                        ? "bg-indigo-600 text-white font-semibold shadow-xs"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive
                          ? "text-white"
                          : "text-slate-400 group-hover:text-slate-200",
                      )}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                  </Link>
                );
              })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 text-center">
          Nghị định 30/2020/NĐ-CP • v1.0
        </div>
      )}
    </aside>
  );
}
