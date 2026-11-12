// src/app/(dashboard)/reports/page.tsx
// Chuyển hướng tới Báo cáo thống kê tích hợp tại Trung tâm Điều hành

import { redirect } from "next/navigation";

export default function ReportsPage() {
  redirect("/dashboard?tab=reports");
}
