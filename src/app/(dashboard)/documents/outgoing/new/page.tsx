// src/app/(dashboard)/documents/outgoing/new/page.tsx
// Form Tạo dự thảo Văn bản đi / Tờ trình nội bộ

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createOutgoingDraftSchema,
  CreateOutgoingDraftFormData,
} from "@/modules/document/schema";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send, UploadCloud, ArrowLeft, Building2, User, Sparkles, FileText } from "lucide-react";

export default function NewOutgoingDraftPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [units, setUnits] = useState<
    Array<{ id: string; name: string; code: string }>
  >([]);
  const [books, setBooks] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateOutgoingDraftFormData>({
    resolver: zodResolver(createOutgoingDraftSchema) as unknown as Resolver<CreateOutgoingDraftFormData>,
    defaultValues: {
      draftUnitId: "",
      documentTypeId: "CV",
      urgency: "NORMAL",
      security: "NORMAL",
      sendType: "Điện tử & Giấy",
    },
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data.positions.length > 0) {
          const ownUnits = j.data.positions.map(
            (p: { unitId: string; unitName: string; unitCode: string }) => ({
              id: p.unitId,
              name: p.unitName,
              code: p.unitCode,
            }),
          );
          setUnits(ownUnits);
          setValue("draftUnitId", ownUnits[0].id);
        }
      })
      .catch(() => {});
    fetch("/api/admin/books")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const outgoing = j.data.filter(
            (b: { bookType: string }) => b.bookType === "OUTGOING",
          );
          setBooks(outgoing);
          if (outgoing.length) setValue("documentBookId", outgoing[0].id);
        }
      })
      .catch(() => toast.error("Không tải được sổ văn bản đi."));
  }, [setValue]);

  async function onSubmit(data: CreateOutgoingDraftFormData) {
    try {
      setIsLoading(true);

      const uploadIds: string[] = [];

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
        uploadIds.push(uploadJson.data.uploadId);
      }

      // 2. Tạo dự thảo văn bản đi
      const res = await fetch("/api/documents/outgoing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          uploadIds,
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
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Soạn thảo Dự thảo Văn bản đi / Tờ trình
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Khởi tạo dự thảo, đính kèm file Word/PDF và thiết lập chuỗi duyệt
            nối tiếp
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Thanh nạp mẫu nhanh chuẩn NĐ 30 */}
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-3.5 space-y-2">
          <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 uppercase tracking-wide">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Nạp mẫu soạn thảo chuẩn (Nghị định 30/2020/NĐ-CP)
          </span>
          <p className="text-xs text-slate-600">
            Chọn thể thức văn bản để nạp sẵn cấu trúc tiêu đề, chức vụ ký và nơi nhận:
          </p>
          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setValue("documentTypeId", "TTr");
                setValue("title", "Tờ trình về việc đề xuất phê duyệt chủ trương và kế hoạch triển khai công tác");
                setValue("signerPosition", "Trưởng phòng");
                setValue("recipientsSummary", "Ban Giám đốc, Các đơn vị liên quan");
                toast.success("Đã nạp mẫu Tờ trình (TTr)");
              }}
              className="px-3 py-1.5 text-xs font-medium bg-white text-indigo-800 border border-indigo-200 rounded hover:bg-indigo-100 hover:border-indigo-400 transition-colors shadow-2xs cursor-pointer"
            >
              📋 Mẫu Tờ trình (TTr)
            </button>
            <button
              type="button"
              onClick={() => {
                setValue("documentTypeId", "CV");
                setValue("title", "V/v phối hợp công tác và trao đổi nghiệp vụ chuyên môn");
                setValue("signerPosition", "Giám đốc");
                setValue("recipientsSummary", "Các cơ quan phối hợp, UBND Tỉnh, Các phòng ban");
                toast.success("Đã nạp mẫu Công văn (CV)");
              }}
              className="px-3 py-1.5 text-xs font-medium bg-white text-indigo-800 border border-indigo-200 rounded hover:bg-indigo-100 hover:border-indigo-400 transition-colors shadow-2xs cursor-pointer"
            >
              📄 Mẫu Công văn (CV)
            </button>
            <button
              type="button"
              onClick={() => {
                setValue("documentTypeId", "BC");
                setValue("title", "Báo cáo kết quả thực hiện nhiệm vụ công tác tháng và phương hướng thời gian tới");
                setValue("signerPosition", "Giám đốc");
                setValue("recipientsSummary", "Cơ quan cấp trên, Ban Giám đốc");
                toast.success("Đã nạp mẫu Báo cáo (BC)");
              }}
              className="px-3 py-1.5 text-xs font-medium bg-white text-indigo-800 border border-indigo-200 rounded hover:bg-indigo-100 hover:border-indigo-400 transition-colors shadow-2xs cursor-pointer"
            >
              📊 Mẫu Báo cáo (BC)
            </button>
          </div>
        </div>

        <div className="bg-white rounded border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Send className="h-4 w-4 text-indigo-600" />
            1. THÔNG TIN DỰ THẢO
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Loại văn bản *
              </label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Đơn vị chủ trì soạn thảo *
              </label>
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
              {errors.draftUnitId && (
                <p className="text-xs text-rose-500 mt-1">
                  {errors.draftUnitId.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sổ văn bản đi *
              </label>
              <select
                {...register("documentBookId")}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded"
              >
                <option value="">Chọn sổ văn bản đi</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Người ký dự kiến
              </label>
              <input
                type="text"
                {...register("signerName")}
                placeholder="VD: Nguyễn Văn An"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chức vụ người ký
              </label>
              <input
                type="text"
                {...register("signerPosition")}
                placeholder="VD: Giám đốc"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Độ khẩn
              </label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Độ mật
              </label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nơi nhận (Tóm tắt)
              </label>
              <input
                type="text"
                {...register("recipientsSummary")}
                placeholder="VD: Các phòng ban, Bộ Nội vụ, UBND Tỉnh..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Trích yếu nội dung dự thảo *
            </label>
            <textarea
              rows={3}
              required
              {...register("title")}
              placeholder="VD: V/v ban hành quy chế quản lý và sử dụng chữ ký số trong cơ quan..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
            {errors.title && (
              <p className="text-xs text-rose-500 mt-1">
                {errors.title.message}
              </p>
            )}
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
            <label
              htmlFor="draft-file"
              className="cursor-pointer flex flex-col items-center"
            >
              <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
              <span className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                {selectedFile
                  ? selectedFile.name
                  : "Tải lên file dự thảo (Word / PDF)"}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                Tự động kiểm tra định dạng và băm mã SHA-256 phục vụ đối soát
                phiên bản
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
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={!units.length || !books.length}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Lưu dự thảo
          </Button>
        </div>
      </form>
    </div>
  );
}
