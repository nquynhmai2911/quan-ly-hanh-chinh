// src/app/(dashboard)/documents/outgoing/new/page.tsx
// Form Tạo dự thảo Văn bản đi / Tờ trình nội bộ

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOutgoingDraftSchema, CreateOutgoingDraftFormData } from "@/modules/document/schema";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send, UploadCloud, ArrowLeft, Building2, User } from "lucide-react";

export default function NewOutgoingDraftPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [units, setUnits] = useState<Array<{ id: string; name: string; code: string }>>([
    { id: "unit-tchc", name: "Phòng Tổ chức - Hành chính", code: "TCHC" },
    { id: "unit-vp", name: "Văn phòng cơ quan", code: "VP" },
    { id: "unit-khtc", name: "Phòng Kế hoạch - Tài chính", code: "KHTC" },
    { id: "unit-cq", name: "Cơ quan hành chính", code: "CQ" },
  ]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateOutgoingDraftFormData>({
    resolver: zodResolver(createOutgoingDraftSchema) as any,
    defaultValues: {
      draftUnitId: "unit-tchc",
      documentTypeId: "CV",
      urgency: "NORMAL",
      security: "NORMAL",
      sendType: "Điện tử & Giấy",
    },
  });

  useEffect(() => {
    fetch("/api/admin/units")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data.length > 0) {
          setUnits(j.data);
          setValue("draftUnitId", j.data[0].id);
        }
      })
      .catch(() => {});
  }, [setValue]);

  async function onSubmit(data: CreateOutgoingDraftFormData) {
    try {
      setIsLoading(true);

      const fileIds: string[] = [];

      // 1. Upload file dự thảo nếu có
      if (selectedFile) {
        const fileForm = new FormData();
        fileForm.append("file", selectedFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: fileForm,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok || !uploadJson.success) {
          toast.error(uploadJson.error?.message || "Lỗi khi tải file dự thảo.");
          return;
        }
        // Gắn fileId nếu có
      }

      // 2. Tạo dự thảo văn bản đi
      const res = await fetch("/api/documents/outgoing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          fileIds,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Khởi tạo dự thảo thất bại.");
        return;
      }

      toast.success("Khởi tạo dự thảo văn bản đi thành công!");
      router.push(`/documents/${json.data.id}`);
      router.refresh();
    } catch {
      toast.error("Lỗi khi kết nối máy chủ.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Soạn thảo Dự thảo Văn bản đi / Tờ trình</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Khởi tạo dự thảo, đính kèm file Word/PDF và thiết lập chuỗi duyệt nối tiếp
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Send className="h-4 w-4 text-indigo-600" />
            1. THÔNG TIN DỰ THẢO
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Loại văn bản *</label>
              <select
                {...register("documentTypeId")}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              >
                <option value="CV">Công văn (CV)</option>
                <option value="TTr">Tờ trình (TTr)</option>
                <option value="QĐ">Quyết định (QĐ)</option>
                <option value="BC">Báo cáo (BC)</option>
                <option value="TB">Thông báo (TB)</option>
                <option value="KH">Kế hoạch (KH)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Đơn vị chủ trì soạn thảo *</label>
              <select
                {...register("draftUnitId")}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
              {errors.draftUnitId && <p className="text-xs text-rose-500 mt-1">{errors.draftUnitId.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Người ký dự kiến</label>
              <input
                type="text"
                {...register("signerName")}
                placeholder="VD: Nguyễn Văn An"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Chức vụ người ký</label>
              <input
                type="text"
                {...register("signerPosition")}
                placeholder="VD: Giám đốc"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Độ khẩn</label>
              <select
                {...register("urgency")}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              >
                <option value="NORMAL">Thường</option>
                <option value="URGENT">Khẩn</option>
                <option value="FIRE">Hỏa tốc</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Độ mật</label>
              <select
                {...register("security")}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              >
                <option value="NORMAL">Thường</option>
                <option value="CONFIDENTIAL">Mật</option>
                <option value="SECRET">Tối mật</option>
                <option value="TOP_SECRET">Tuyệt mật</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nơi nhận (Tóm tắt)</label>
              <input
                type="text"
                {...register("recipientsSummary")}
                placeholder="VD: Các phòng ban, Bộ Nội vụ, UBND Tỉnh..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Trích yếu nội dung dự thảo *</label>
            <textarea
              rows={3}
              required
              {...register("title")}
              placeholder="VD: V/v ban hành quy chế quản lý và sử dụng chữ ký số trong cơ quan..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
            {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title.message}</p>}
          </div>
        </div>

        {/* Đính kèm file dự thảo */}
        <div className="bg-white rounded border border-slate-200 p-6 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-indigo-600" />
            2. FILE DỰ THẢO (WORD / PDF)
          </h2>

          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors bg-slate-50/50">
            <input
              type="file"
              id="draft-file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <label htmlFor="draft-file" className="cursor-pointer flex flex-col items-center">
              <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
              <span className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                {selectedFile ? selectedFile.name : "Tải lên file dự thảo (Word / PDF)"}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                Tự động kiểm tra định dạng và băm mã SHA-256 phục vụ đối soát phiên bản
              </span>
              {selectedFile && (
                <span className="text-xs text-emerald-600 font-medium mt-2 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Đã chọn: {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
              )}
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Hủy bỏ
          </Button>
          <Button type="submit" isLoading={isLoading} className="gap-2">
            <Send className="h-4 w-4" />
            Lưu dự thảo
          </Button>
        </div>
      </form>
    </div>
  );
}
