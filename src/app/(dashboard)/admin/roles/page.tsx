// src/app/(dashboard)/admin/roles/page.tsx
// Chuyển hướng hợp nhất về menu "Phân quyền người dùng" (Tab Phân quyền theo Vai trò)

import { redirect } from "next/navigation";

export default function AdminRolesPage() {
  redirect("/admin/users?tab=roles");
}
