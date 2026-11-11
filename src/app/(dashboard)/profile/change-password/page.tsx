// src/app/(dashboard)/profile/change-password/page.tsx
// Màn hình Đổi mật khẩu cá nhân

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, ChangePasswordFormData } from "@/modules/auth/schema";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Key, Lock, CheckCircle2 } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  async function onSubmit(data: ChangePasswordFormData) {
    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Đổi mật khẩu thất bại.");
        return;
      }

      toast.success("Đổi mật khẩu thành công!");
      reset();
    } catch {
      toast.error("Lỗi khi kết nối đến máy chủ.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Đổi mật khẩu</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Cập nhật mật khẩu để bảo vệ an toàn cho tài khoản cán bộ
        </p>
      </div>

      <div className="bg-white rounded border border-slate-200 p-6 shadow-xs">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu hiện tại *
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                {...register("currentPassword")}
                placeholder="Nhập mật khẩu hiện tại"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
            {errors.currentPassword && (
              <p className="text-xs text-rose-500 mt-1">{errors.currentPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu mới *
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                {...register("newPassword")}
                placeholder="Tối thiểu 6 ký tự"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
            {errors.newPassword && (
              <p className="text-xs text-rose-500 mt-1">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Xác nhận mật khẩu mới *
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                {...register("confirmPassword")}
                placeholder="Nhập lại mật khẩu mới"
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-rose-500 mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => router.back()}>
              Quay lại
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Cập nhật mật khẩu
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
