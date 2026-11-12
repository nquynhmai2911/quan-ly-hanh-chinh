// src/app/(dashboard)/admin/roles/page.tsx
// Chuyển hướng hợp nhất về menu "Phân quyền người dùng" (Tab Phân quyền theo Vai trò)

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRolesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/users?tab=roles");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center p-12 text-slate-500 text-sm">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
      <p>Đang chuyển hướng tới màn hình Phân quyền người dùng...</p>
    </div>
  );
}
