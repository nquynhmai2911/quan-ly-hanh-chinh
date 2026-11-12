// src/app/(dashboard)/catalogs/books/page.tsx
// Màn hình Tra cứu Sổ văn bản cơ quan cho toàn thể cán bộ

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, Search, Hash, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface BookData {
  id: string;
  name: string;
  code: string;
  bookType: "INCOMING" | "OUTGOING";
  numberTemplate: string;
  unit?: { name: string; code: string } | null;
  counters: Array<{ year: number; lastNumber: number }>;
  _count?: { documents: number };
}

export default function BooksDirectoryPage() {
  const [books, setBooks] = useState<BookData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canView, setCanView] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const roles = j.data.roles || [];
          const permissions = j.data.permissions || {};
          const isAdmin = roles.includes("ADMIN");
          const hasView =
            isAdmin ||
            Boolean(permissions["catalog.view"]) ||
            Boolean(permissions["catalog.manage"]);
          setCanView(hasView);
        } else {
          setCanView(false);
        }
      })
      .catch(() => setCanView(false));

    fetch("/api/admin/books")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setBooks(j.data);
      })
      .catch(() => toast.error("Không thể tải danh sách sổ."))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = books.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.code.toLowerCase().includes(search.toLowerCase())
  );

  if (canView === false) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm max-w-lg mx-auto my-12">
        <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">
          Tài khoản của bạn hiện không có quyền xem sổ văn bản. Vui lòng liên hệ Quản trị viên nếu cần cấp lại quyền.
        </p>
        <Link href="/dashboard">
          <Button variant="outline">Quay lại Bàn làm việc</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sổ văn bản Cơ quan</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Danh mục hệ thống sổ đăng ký văn bản đến và văn bản đi theo niên khóa
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm sổ văn bản theo tên hoặc mã..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="text-xs text-slate-400">Đang tải sổ văn bản...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-slate-400">Không tìm thấy sổ văn bản phù hợp.</p>
        ) : (
          filtered.map((b) => (
            <div key={b.id} className="bg-white rounded border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div className="p-2 rounded bg-indigo-50 text-indigo-600">
                  <BookOpen className="h-5 w-5" />
                </div>
                <Badge variant={b.bookType === "INCOMING" ? "info" : "success"}>
                  {b.bookType === "INCOMING" ? "Sổ đến" : "Sổ đi"}
                </Badge>
              </div>

              <div>
                <h3 className="font-bold text-sm text-slate-900">{b.name}</h3>
                <span className="font-mono text-xs text-slate-500 font-semibold">{b.code}</span>
              </div>

              <div className="pt-2 border-t border-slate-100 text-xs space-y-1 text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Đơn vị quản lý:</span>
                  <span className="font-medium text-slate-800">
                    {b.unit ? `${b.unit.name} (${b.unit.code})` : "Toàn cơ quan"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Số hiện tại (Năm nay):</span>
                  <span className="font-bold text-indigo-600 font-mono text-sm">
                    {b.counters[0]?.lastNumber || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Mẫu số:</span>
                  <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                    {b.numberTemplate}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
