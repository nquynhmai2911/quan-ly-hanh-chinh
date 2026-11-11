// src/app/(dashboard)/citizen/submit/page.tsx
// Cổng Dịch vụ công & Tiếp nhận Văn bản / Đơn thư trực tuyến từ Người dân & Doanh nghiệp

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileText,
  Send,
  UploadCloud,
  CheckCircle2,
  Clock,
  Shield,
  Phone,
  Mail,
  MapPin,
  Building,
  User,
  ArrowRight,
  HelpCircle,
  FileCheck,
} from "lucide-react";

export default function CitizenSubmitPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [submittedDocId, setSubmittedDocId] = useState<string | null>(null);

  const [form, setForm] = useState({
    senderName: "Nguyễn Văn Dân",
    senderPhone: "0912.345.678",
    senderEmail: "nguoidan@eoffice.local",
    senderAddress: "Số 15 đường Trần Phú, Phường 1, Thành phố",
    docType: "Đơn kiến nghị / Phản ánh",
    urgency: "NORMAL",
    title: "",
    note: "",
    fileName: "",
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setForm((prev) => ({ ...prev, fileName: file.name }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title.trim()) {
      toast.error("Vui lòng nhập trích yếu nội dung văn bản / đơn kiến nghị.");
      return;
    }
    if (!form.senderName.trim()) {
      toast.error("Vui lòng nhập họ tên người gửi.");
      return;
    }

    try {
      setIsLoading(true);
      let uploadedFileKey = "";

      // Nếu người dân chọn tệp thực tế từ thiết bị, tải lên server lưu vào storage
      if (selectedFile) {
        try {
          const fd = new FormData();
          fd.append("file", selectedFile);
          const upRes = await fetch("/api/upload", {
            method: "POST",
            body: fd,
          });
          const upJson = await upRes.json();
          if (upJson.success && upJson.data?.fileKey) {
            uploadedFileKey = upJson.data.fileKey;
          }
        } catch (uploadErr) {
          console.warn("Upload file failed, fallback to metadata:", uploadErr);
        }
      }

      const res = await fetch("/api/citizen/submit-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          fileKey: uploadedFileKey,
          fileName: selectedFile ? selectedFile.name : (form.fileName || "Don-kien-nghi-truc-tuyen.pdf"),
          fileSize: selectedFile ? selectedFile.size : 450000,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Không thể gửi văn bản.");
        return;
      }

      setSubmittedCode(json.data.onlineCode);
      setSubmittedDocId(json.data.id);
      toast.success(json.data.message || "Gửi văn bản đến cơ quan thành công!");
    } catch {
      toast.error("Lỗi khi kết nối đến máy chủ.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Banner Cổng dịch vụ công */}
      <div className="bg-linear-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white rounded-lg p-6 shadow-md border border-indigo-700/50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-semibold mb-2 border border-indigo-400/30">
              <Shield className="h-3.5 w-3.5" /> Cổng Tiếp nhận Văn bản & Đơn Thư Trực Tuyến
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Gửi Văn Bản Đến Chờ Tiếp Nhận
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200 mt-1 max-w-xl">
              Hệ thống tiếp nhận điện tử 24/7 dành cho Người dân và Doanh nghiệp. Văn bản gửi đi sẽ được Văn thư cơ quan tiếp nhận, vào sổ và chuyển Lãnh đạo chỉ đạo xử lý đúng quy định.
            </p>
          </div>

          <div className="hidden sm:block text-right">
            <div className="bg-white/10 backdrop-blur-xs px-3.5 py-2.5 rounded border border-white/20 text-xs">
              <span className="block text-indigo-200">Thời gian tiếp nhận</span>
              <span className="font-bold text-white">Trong vòng 02 giờ làm việc</span>
            </div>
          </div>
        </div>
      </div>

      {submittedCode ? (
        /* Màn hình thông báo gửi thành công */
        <div className="bg-white rounded-lg border border-emerald-200 p-8 shadow-xs text-center space-y-5">
          <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">Nộp Văn Bản Trực Tuyến Thành Công!</h2>
            <p className="text-xs text-slate-500">
              Văn bản của bạn đã được chuyển đến bộ phận Văn thư cơ quan và đang ở trạng thái <strong>Chờ vào sổ tiếp nhận</strong>.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-w-md mx-auto space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Mã tra cứu hồ sơ:</span>
              <span className="font-mono font-bold text-base text-indigo-600">{submittedCode}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Trạng thái hiện tại:</span>
              <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Chờ tiếp nhận vào sổ
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Người nộp:</span>
              <span className="font-medium text-slate-800">{form.senderName}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {submittedDocId && (
              <Button
                variant="primary"
                onClick={() => router.push(`/documents/${submittedDocId}`)}
                className="gap-2"
              >
                <FileCheck className="h-4 w-4" /> Xem Tiến Độ Văn Bản
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setSubmittedCode(null);
                setSubmittedDocId(null);
                setForm((prev) => ({ ...prev, title: "", note: "" }));
              }}
            >
              Gửi thêm văn bản khác
            </Button>
          </div>
        </div>
      ) : (
        /* Form nộp văn bản */
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. THÔNG TIN NGƯỜI GỬI */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
              <User className="h-4 w-4 text-indigo-600" />
              1. Thông Tin Người Gửi / Doanh Nghiệp
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên người gửi / Tên tổ chức, Doanh nghiệp *
                </label>
                <input
                  type="text"
                  required
                  value={form.senderName}
                  onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn Dân hoặc Công ty TNHH Phát triển X"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số điện thoại liên hệ *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={form.senderPhone}
                    onChange={(e) => setForm({ ...form, senderPhone: e.target.value })}
                    placeholder="0912.xxx.xxx"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email nhận thông báo kết quả
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={form.senderEmail}
                    onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
                    placeholder="nguoidan@example.com"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Địa chỉ liên hệ
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={form.senderAddress}
                    onChange={(e) => setForm({ ...form, senderAddress: e.target.value })}
                    placeholder="Số nhà, đường, phường/xã, quận/huyện"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. NỘI DUNG VĂN BẢN / ĐƠN THƯ */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileText className="h-4 w-4 text-indigo-600" />
              2. Nội Dung Văn Bản / Đơn Thư Gửi Cơ Quan
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Loại văn bản / Thể thức *
                </label>
                <select
                  value={form.docType}
                  onChange={(e) => setForm({ ...form, docType: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  <option value="Đơn kiến nghị / Phản ánh">Đơn kiến nghị / Phản ánh</option>
                  <option value="Đơn đề nghị giải quyết thủ tục">Đơn đề nghị giải quyết thủ tục</option>
                  <option value="Công văn đề xuất">Công văn đề xuất</option>
                  <option value="Báo cáo tình hình">Báo cáo tình hình</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mức độ ưu tiên / Độ khẩn
                </label>
                <select
                  value={form.urgency}
                  onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  <option value="NORMAL">Bình thường</option>
                  <option value="URGENT">Khẩn</option>
                  <option value="FIRE">Hỏa tốc</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trích yếu nội dung văn bản / Tiêu đề đơn kiến nghị *
                </label>
                <textarea
                  required
                  rows={3}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ví dụ: Đơn kiến nghị giải quyết phản ánh về việc nâng cấp hệ thống đường điện dân sinh tại khu phố 3..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi chú hoặc thông tin bổ sung (nếu có)
                </label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Thông tin thêm giúp cơ quan xử lý nhanh hơn"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. TỆP ĐÍNH KÈM / SCAN VĂN BẢN */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase flex items-center gap-2 border-b border-slate-100 pb-2">
              <UploadCloud className="h-4 w-4 text-indigo-600" />
              3. Tệp Đính Kèm / Scan Đơn Có Chữ Ký
            </h2>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors">
              <UploadCloud className="h-10 w-10 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-700 font-medium">
                {selectedFile ? (
                  <span className="text-indigo-600 font-bold">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                ) : (
                  "Kéo thả tệp PDF, Word, Ảnh chụp đơn thư hoặc bấm để chọn tệp"
                )}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Định dạng hỗ trợ: PDF, DOCX, DOC, JPG, PNG (Tối đa 25MB)</p>
              <input
                type="file"
                id="file-upload"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              />
              <label
                htmlFor="file-upload"
                className="inline-block mt-3 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded cursor-pointer transition-colors"
              >
                Chọn tệp từ thiết bị
              </label>
            </div>
          </div>

          {/* Nút hành động */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" />
              Văn bản gửi đi sẽ được cấp mã tra cứu theo dõi trực tuyến ngay sau khi nộp
            </span>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="gap-2 px-6 h-10 font-bold"
            >
              <Send className="h-4 w-4" /> Gửi Văn Bản Đến Cơ Quan
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
