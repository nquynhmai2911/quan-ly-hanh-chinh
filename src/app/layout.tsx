// src/app/layout.tsx
// Root Layout chuẩn Enterprise cho hệ thống E-Office

import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "E-Office | Quản lý Văn bản & Điều hành Hành chính",
  description: "Hệ thống quản lý văn bản, điều hành và lưu trữ hồ sơ hành chính điện tử theo Nghị định 30/2020/NĐ-CP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
