// src/lib/utils.ts
// Utility functions dùng chung

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes (cho shadcn/ui) */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Debounce function */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/** Format ngày giờ tiếng Việt */
export function formatDate(date: Date | string, includeTime = false): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();

  if (!includeTime) return `${day}/${month}/${year}`;

  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/** Chuẩn hóa tên file upload: bỏ dấu, thay khoảng trắng bằng gạch dưới */
export function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Bỏ dấu
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Thay ký tự đặc biệt bằng _
    .replace(/_+/g, "_") // Gom nhiều _ thành 1
    .replace(/^_|_$/g, ""); // Bỏ _ đầu/cuối
}

/** Chuyển bytes sang text đọc được */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/** Tạo breadcrumb path từ URL */
export function buildBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: { label: string; href: string }[] = [];
  let currentPath = "";

  const labelMap: Record<string, string> = {
    dashboard: "Tổng quan",
    "incoming-documents": "Văn bản đến",
    "outgoing-documents": "Văn bản đi",
    admin: "Quản trị",
    users: "Người dùng",
    units: "Đơn vị",
    roles: "Vai trò",
    catalogs: "Danh mục",
    "document-types": "Loại văn bản",
    "document-books": "Sổ văn bản",
    fields: "Lĩnh vực",
    "external-orgs": "Cơ quan ngoài",
    archives: "Hồ sơ lưu trữ",
    settings: "Cài đặt",
    create: "Tạo mới",
    edit: "Chỉnh sửa",
  };

  for (const segment of segments) {
    currentPath += `/${segment}`;
    breadcrumbs.push({
      label: labelMap[segment] || segment,
      href: currentPath,
    });
  }

  return breadcrumbs;
}
