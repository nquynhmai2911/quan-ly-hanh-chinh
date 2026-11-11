// src/app/page.tsx
// Chuyển hướng người dùng vào hệ thống làm việc

import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/documents/incoming");
}
