// src/components/layout/command-palette.tsx
// Quick Search Dialog điều hướng nhanh toàn hệ thống (Ctrl + K)

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Send, Archive, Users, Building, ShieldCheck, BookOpen, Key, X } from "lucide-react";

interface QuickItem {
  id: string;
  title: string;
  category: string;
  href: string;
  icon: React.ReactNode;
}

const QUICK_ACTIONS: QuickItem[] = [
  { id: "1", title: "Danh sách Văn bản đến", category: "Văn bản", href: "/documents/incoming", icon: <FileText className="h-4 w-4" /> },
  { id: "2", title: "Vào sổ Văn bản đến mới", category: "Văn bản", href: "/documents/incoming/new", icon: <FileText className="h-4 w-4" /> },
  { id: "3", title: "Danh sách Văn bản đi / Tờ trình", category: "Văn bản", href: "/documents/outgoing", icon: <Send className="h-4 w-4" /> },
  { id: "4", title: "Tạo dự thảo Văn bản đi mới", category: "Văn bản", href: "/documents/outgoing/new", icon: <Send className="h-4 w-4" /> },
  { id: "5", title: "Hồ sơ công việc / Lưu trữ", category: "Lưu trữ", href: "/archives", icon: <Archive className="h-4 w-4" /> },
  { id: "6", title: "Sổ văn bản", category: "Danh mục", href: "/catalogs/books", icon: <BookOpen className="h-4 w-4" /> },
  { id: "7", title: "Quản lý Người dùng & Nhân sự", category: "Quản trị", href: "/admin/users", icon: <Users className="h-4 w-4" /> },
  { id: "8", title: "Cây đơn vị & Phòng ban", category: "Quản trị", href: "/admin/units", icon: <Building className="h-4 w-4" /> },
  { id: "9", title: "Phân quyền & Vai trò", category: "Quản trị", href: "/admin/roles", icon: <ShieldCheck className="h-4 w-4" /> },
  { id: "10", title: "Đổi mật khẩu tài khoản", category: "Cá nhân", href: "/profile/change-password", icon: <Key className="h-4 w-4" /> },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  // Bắt phím Ctrl + K (hoặc Cmd + K trên Mac)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const filtered = QUICK_ACTIONS.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  function handleSelect(href: string) {
    setIsOpen(false);
    setQuery("");
    router.push(href);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      <div className="relative w-full max-w-xl bg-white rounded shadow-2xl border border-slate-200 overflow-hidden z-10 animate-scale-in">
        <div className="flex items-center px-4 border-b border-slate-200 bg-slate-50/50">
          <Search className="h-4 w-4 text-slate-400 mr-2.5 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm chức năng, màn hình, văn bản (Ctrl+K)..."
            autoFocus
            className="w-full py-3 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
          />
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Không tìm thấy mục nào khớp với từ khóa &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item.href)}
                className="flex items-center justify-between px-3 py-2.5 rounded hover:bg-slate-100 cursor-pointer transition-colors text-slate-700"
              >
                <div className="flex items-center gap-3">
                  <div className="text-slate-500">{item.icon}</div>
                  <span className="text-sm font-medium">{item.title}</span>
                </div>
                <span className="text-xs text-slate-400 font-mono bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                  {item.category}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Nhấn ESC để đóng</span>
          <span>Dùng phím mũi tên hoặc click để chọn</span>
        </div>
      </div>
    </div>
  );
}
