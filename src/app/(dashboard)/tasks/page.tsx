// src/app/(dashboard)/tasks/page.tsx
// Chuyển hướng tới Bàn làm việc tích hợp tại Trung tâm Điều hành

import { redirect } from "next/navigation";

export default function TasksPage() {
  redirect("/dashboard?tab=tasks");
}
