// src/app/(dashboard)/documents/incoming/new/page.tsx
// Form Vào sổ và Tiếp nhận Văn bản đến mới (Kèm tải file đính kèm/scan)

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createIncomingDocumentSchema, CreateIncomingDocumentFormData } from "@/modules/document/schema";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileText, UploadCloud, ArrowLeft, Building2, Calendar, Shield, Flame } from "lucide-react";

export default function NewIncomingDocumentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [books, setBooks] = useState<Array<{ id: string; name: string; code: string }>>([
    { id: "book-den", name: "Sổ văn bản đến chung", code: "SVB-DEN" },
    { id: "book-khan", name: "Sổ văn bản đến khẩn / hỏa tốc", code: "SVB-KHAN" },
  ]);
  const [docTypes, setDocTypes] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [externalOrgs, setExternalOrgs] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateIncomingDocumentFormData>({
    resolver: zodResolver(createIncomingDocumentSchema) as any,
    defaultValues: {
      documentBookId: "book-den",
      documentTypeId: "CV",
      urgency: "NORMAL",
      security: "NORMAL",
      issuedDate: new Date(),
      receivedDate: new Date(),
    },
  });

  useEffect(() => {
    // Tải danh mục sổ văn bản đến
    fetch("/api/admin/books")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data.length > 0) {
          const incoming = j.data.filter((b: { bookType: string }) => b.bookType === "INCOMING");
          if (incoming.length > 0) {
            setBooks(incoming);
            setValue("documentBookId", incoming[0].id);
          }
        }
      })
      .catch(() => {});

    // Tải loại văn bản
    fetch("/api/admin/units") // Có thể tải catalog
      .catch(() => {});
  }, [setValue]);

  async function onSubmit(data: CreateIncomingDocumentFormData) {
    try {
      setIsLoading(true);

      // 1. Nếu có file đính kèm, upload trước qua /api/upload
      let uploadedFileKey = null;
      if (selectedFile) {
        const fileForm = new FormData();
        fileForm.append("file", selectedFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: fileForm,
        });
        const uploadJson = await uploadRes.json();
        if (!uploadRes.ok || !uploadJson.success) {
          toast.error(uploadJson.error?.message || "Lỗi khi tải file đính kèm.");
          return;
        }
        uploadedFileKey = uploadJson.data;
      }

      // 2. Tiếp nhận văn bản qua /api/documents/incoming
      const res = await fetch("/api/documents/incoming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          fileKey: uploadedFileKey?.fileKey,
          fileName: uploadedFileKey?.fileName,
          fileHash: uploadedFileKey?.fileHash,
          fileSize: uploadedFileKey?.fileSize,
          mimeType: uploadedFileKey?.mimeType,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Vào sổ văn bản đến thất bại.");
        return;
      }

      toast.success(`Đã vào sổ thành công! Số đến: ${json.data.documentNumber}`);
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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Tiếp nhận & Vào sổ Văn bản đến</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Đăng ký văn bản vào sổ, cấp số đến và chuẩn bị trình Lãnh đạo cho ý kiến chỉ đạo
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white rounded border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600" />
            1. THÔNG TIN SỔ & VĂN BẢN ĐẾN
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sổ văn bản đến *</label>
              <select
                {...register("documentBookId")}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              >
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
              {errors.documentBookId && <p className="text-xs text-rose-500 mt-1">{errors.documentBookId.message}</p>}
            </div>

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
                <option value="GM">Giấy mời (GM)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Số/Ký hiệu gốc trên văn bản</label>
              <input
                type="text"
                {...register("originalCode")}
                placeholder="VD: 145/BNV-TCCB"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cơ quan / Đơn vị gửi văn bản</label>
              <input
                type="text"
                {...register("senderName")}
                placeholder="VD: Bộ Nội vụ, UBND Tỉnh..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày ban hành trên văn bản *</label>
              <input
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setValue("issuedDate", new Date(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày đến cơ quan</label>
              <input
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setValue("receivedDate", new Date(e.target.value))}
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hạn xử lý (nếu có)</label>
              <input
                type="date"
                onChange={(e) => setValue("processingDeadline", e.target.value ? new Date(e.target.value) : null)}
                className="w-full md:w-1/2 px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Trích yếu nội dung văn bản *</label>
            <textarea
              rows={3}
              required
              {...register("title")}
              placeholder="VD: V/v hướng dẫn công tác văn thư lưu trữ và quản lý văn bản điện tử năm 2026..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
            {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title.message}</p>}
          </div>
        </div>

        {/* Đính kèm file */}
        <div className="bg-white rounded border border-slate-200 p-6 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-indigo-600" />
            2. ĐÍNH KÈM TÀI LIỆU / BẢN SCAN
          </h2>

          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors bg-slate-50/50">
            <input
              type="file"
              id="file-upload"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
              <span className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                {selectedFile ? selectedFile.name : "Nhấp vào đây để chọn file đính kèm"}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                Hỗ trợ PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Tối đa 25MB)
              </span>
              {selectedFile && (
                <span className="text-xs text-emerald-600 font-medium mt-2 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Đã chọn: {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
              )}
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Hủy bỏ
          </Button>
          <Button type="submit" isLoading={isLoading} className="gap-2">
            <FileText className="h-4 w-4" />
            Vào sổ & Cấp số đến
          </Button>
        </div>
      </form>
    </div>
  );
}
