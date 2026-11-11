// src/app/(dashboard)/dashboard-shell.tsx
// Shell tương tác client cho layout: quản lý phím tắt, trạng thái thu gọn sidebar, command palette

"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CommandPalette } from "@/components/layout/command-palette";
import { SessionUser } from "@/types/auth";

interface DashboardShellProps {
  user: SessionUser | null;
  roles?: string[];
  primaryPositionName?: string;
  primaryUnitName?: string;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  roles = [],
  primaryPositionName,
  primaryUnitName,
  children,
}: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Phím tắt Ctrl + B mở/đóng Sidebar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
        userRoles={roles}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          user={user}
          primaryPositionName={primaryPositionName}
          primaryUnitName={primaryUnitName}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>

      {/* Quick Search Modal */}
      <CommandPalette />
    </div>
  );
}
