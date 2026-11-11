// src/components/layout/header.tsx
// Header điều hành: Quick Search (Ctrl+K), Chuông thông báo, Menu người dùng

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Bell,
  User,
  Key,
  LogOut,
  ChevronDown,
  Building,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { SessionUser } from "@/types/auth";

interface HeaderProps {
  user: SessionUser | null;
  primaryPositionName?: string;
  primaryUnitName?: string;
  onOpenSearch: () => void;
}

export function Header({
  user,
  primaryPositionName,
  primaryUnitName,
  onOpenSearch,
}: HeaderProps) {
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
        setNotificationOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Đã đăng xuất khỏi hệ thống.");
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Lỗi khi đăng xuất.");
    }
  }

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .slice(-2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      {/* Vùng tìm kiếm nhanh */}
      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 bg-slate-100 hover:bg-slate-200/80 rounded border border-slate-200 transition-colors w-64 md:w-80 text-left cursor-pointer"
      >
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <span className="flex-1 truncate">Tìm nhanh văn bản, chức năng...</span>
        <kbd className="hidden sm:inline-block bg-white text-slate-500 border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-mono shadow-2xs">
          Ctrl K
        </kbd>
      </button>

      {/* Vùng hành động bên phải */}
      <div className="flex items-center gap-3" ref={menuRef}>
        {/* Chuông thông báo */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationOpen(!notificationOpen);
              setUserMenuOpen(false);
            }}
            className="p-2 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors relative"
            title="Thông báo"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>

          {notificationOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded shadow-xl border border-slate-200 py-2 z-50 animate-scale-in">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">Thông báo mới</span>
                <span className="text-[11px] text-indigo-600 hover:underline cursor-pointer">
                  Đánh dấu đã đọc
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 text-xs">
                <div className="p-3 hover:bg-slate-50 transition-colors cursor-pointer">
                  <p className="font-semibold text-slate-800">Chào mừng bạn đến với E-Office</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Hệ thống đã sẵn sàng vận hành tiếp nhận và xử lý văn bản hành chính.
                  </p>
                  <span className="text-[10px] text-slate-400 mt-1 block">Vừa xong</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotificationOpen(false);
            }}
            className="flex items-center gap-2.5 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="h-8 w-8 rounded-full bg-indigo-600 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-2xs">
              {initials}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 leading-tight">
                {user?.fullName || "Người dùng"}
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                {primaryPositionName || "Cán bộ"} • {primaryUnitName || "Cơ quan"}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden md:block" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded shadow-xl border border-slate-200 py-1.5 z-50 animate-scale-in">
              <div className="px-3 py-2 border-b border-slate-100 text-xs">
                <p className="font-semibold text-slate-800">{user?.fullName}</p>
                <p className="text-slate-500 text-[11px] truncate">{user?.email}</p>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded w-fit">
                  <Building className="h-3 w-3" />
                  <span>{primaryUnitName || "Cơ quan"}</span>
                </div>
              </div>

              <div className="py-1 text-xs">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    router.push("/profile/change-password");
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Key className="h-3.5 w-3.5 text-slate-400" />
                  <span>Đổi mật khẩu</span>
                </button>
              </div>

              <div className="pt-1 border-t border-slate-100 text-xs">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 transition-colors font-medium"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
