// src/app/(dashboard)/documents/[id]/page.tsx
// Màn hình Chi tiết Văn bản dạng Split-screen: Trái 60% File Viewer, Phải 40% Tabs & Timeline

"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge, DocumentStatusBadge, UrgencyBadge, SecurityBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import {
  FileText,
  Clock,
  UserCheck,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Download,
  Shield,
  FileCheck,
  Send,
  Eye,
  CornerDownLeft,
  Printer,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { AllowedAction } from "@/modules/document/state-machine";

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: docId } = use(params);

  const [docData, setDocData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [allowedActions, setAllowedActions] = useState<AllowedAction[]>([]);
  const [activeTab, setActiveTab] = useState<"info" | "timeline" | "handlers" | "files">("info");
  const [previewMode, setPreviewMode] = useState<"doc" | "pdf">("doc");
  const [isLoading, setIsLoading] = useState(true);

  // Action states
  const [selectedAction, setSelectedAction] = useState<AllowedAction | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Drawer phân công
  const [isAssignDrawerOpen, setIsAssignDrawerOpen] = useState(false);

  // Drawer báo cáo kết quả
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  const [reportContent, setReportContent] = useState("");

  async function fetchDocumentDetail() {
    try {
      setIsLoading(true);
      // Thử tải qua incoming trước, nếu 404 thì tải outgoing
      let res = await fetch(`/api/documents/incoming/${docId}`);
      if (!res.ok) {
        res = await fetch(`/api/documents/outgoing/${docId}`);
      }
      const json = await res.json();
      if (json.success) {
        setDocData(json.data.document);
        setAuditLogs(json.data.auditLogs || []);
        setAllowedActions(json.data.allowedActions || []);
      } else {
        toast.error(json.error?.message || "Không thể tải chi tiết văn bản.");
      }
    } catch {
      toast.error("Lỗi khi tải dữ liệu văn bản.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchDocumentDetail();
  }, [docId]);

  function handleTriggerAction(action: AllowedAction) {
    setSelectedAction(action);
    setActionReason("");
    setIsConfirmOpen(true);
  }

  async function handleExecuteAction() {
    if (!selectedAction) return;

    if (selectedAction.requiresReason && !actionReason.trim()) {
      toast.error("Thao tác này bắt buộc phải nhập lý do cụ thể.");
      return;
    }

    try {
      setIsActionLoading(true);

      // Nếu là hành động ký duyệt của Lãnh đạo
      if (selectedAction.action === "LEADER_APPROVE" && docData.direction === "OUTGOING") {
        const signRes = await fetch(`/api/documents/outgoing/${docId}/sign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const signJson = await signRes.json();
        if (!signRes.ok || !signJson.success) {
          toast.error(signJson.error?.message || "Ký số phê duyệt thất bại.");
          return;
        }
        toast.success("Phê duyệt điện tử và ký số thành công!");
        setIsConfirmOpen(false);
        fetchDocumentDetail();
        return;
      }

      // Các thao tác khác chuyển trạng thái qua State Machine
      const res = await fetch("/api/documents/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: docId,
          action: selectedAction.action,
          reason: actionReason,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Thao tác không thành công.");
        return;
      }

      toast.success(`Đã thực hiện: ${selectedAction.label}`);
      setIsConfirmOpen(false);
      fetchDocumentDetail();
    } catch {
      toast.error("Lỗi kết nối khi thực thi hành động.");
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleNopBaoCao(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsActionLoading(true);
      const res = await fetch(`/api/documents/incoming/${docId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportContent }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Nộp báo cáo thất bại.");
        return;
      }
      toast.success("Đã nộp báo cáo kết quả xử lý thành công!");
      setIsReportDrawerOpen(false);
      fetchDocumentDetail();
    } catch {
      toast.error("Lỗi khi nộp báo cáo.");
    } finally {
      setIsActionLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="h-[80vh] flex items-center justify-center text-slate-500 text-sm">
        Đang tải hồ sơ văn bản...
      </div>
    );
  }

  if (!docData) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Không tìm thấy thông tin văn bản.
      </div>
    );
  }

  const primaryFile = docData.files?.[0];

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] space-y-3">
      {/* Top Header Bar */}
      <div className="bg-white rounded border border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                {docData.documentNumber || docData.originalCode || "Chưa cấp số"}
              </span>
              <DocumentStatusBadge status={docData.status} />
              <UrgencyBadge level={docData.urgency} />
              <SecurityBadge level={docData.security} />
            </div>
            <h1 className="text-sm font-bold text-slate-900 mt-1 line-clamp-1 max-w-xl">
              {docData.title}
            </h1>
          </div>
        </div>

        {/* Dynamic Action Buttons (Sinh từ State Machine) */}
        <div className="flex items-center gap-2">
          {/* Nút nộp báo cáo nếu là chuyên viên thụ lý */}
          {docData.direction === "INCOMING" && docData.status === "PROCESSING" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReportDrawerOpen(true)}
              className="text-xs"
            >
              <FileCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" />
              Nộp báo cáo kết quả
            </Button>
          )}

          {allowedActions.map((act) => (
            <Button
              key={act.action}
              size="sm"
              variant={
                act.action.includes("REJECT") || act.action.includes("RETURN") || act.action === "CANCEL"
                  ? "danger"
                  : "primary"
              }
              onClick={() => handleTriggerAction(act)}
              className="text-xs shadow-xs"
            >
              {act.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Split-Screen: Trái 60% File Viewer, Phải 40% Tabs */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* Cột trái (60% ~ 7 cols): Smart E-Document & PDF Viewer */}
        <div className="lg:col-span-7 bg-white rounded border border-slate-200 flex flex-col overflow-hidden shadow-xs">
          {/* Header chọn chế độ xem */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded">
              <button
                type="button"
                onClick={() => setPreviewMode("doc")}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  previewMode === "doc"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="h-3.5 w-3.5 text-indigo-600" />
                Bản văn bản điện tử (A4)
              </button>

              <button
                type="button"
                onClick={() => setPreviewMode("pdf")}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  previewMode === "pdf"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Paperclip className="h-3.5 w-3.5 text-indigo-600" />
                Tệp đính kèm {primaryFile ? `(1)` : `(0)`}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {previewMode === "doc" ? (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded font-medium cursor-pointer"
                  title="In bản văn bản này"
                >
                  <Printer className="h-3.5 w-3.5" />
                  In bản in
                </button>
              ) : primaryFile ? (
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/files/${primaryFile.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
                    title="Mở tab mới"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Mở tab mới
                  </a>
                  <a
                    href={`/api/files/${primaryFile.id}`}
                    download={primaryFile.fileName}
                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Tải về ({(primaryFile.fileSize / 1024).toFixed(1)} KB)
                  </a>
                </div>
              ) : null}
            </div>
          </div>

          {/* Vùng nội dung xem */}
          {previewMode === "doc" ? (
            <div className="flex-1 bg-slate-200/80 p-3 sm:p-5 overflow-y-auto flex justify-center">
              <div className="w-full max-w-[700px] bg-white shadow-md border border-slate-300 p-6 sm:p-9 text-slate-800 flex flex-col justify-between min-h-[780px] rounded-xs font-sans">
                {/* Phần đầu: Quốc hiệu, Tiêu ngữ, Cơ quan / Người gửi */}
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-2 border-b border-slate-200 pb-3">
                    {/* Cột trái */}
                    <div className="col-span-5 text-center sm:text-left space-y-0.5">
                      {docData.direction === "INCOMING" &&
                      (docData.originalCode?.startsWith("DTT") || docData.creator?.employeeCode === "CITIZEN") ? (
                        <>
                          <p className="font-sans text-[11px] font-bold text-slate-900 uppercase tracking-tight">
                            CỔNG TIẾP NHẬN DỊCH VỤ CÔNG
                          </p>
                          <p className="font-sans text-[10px] text-slate-500 font-medium">
                            TIẾP NHẬN ĐƠN THƯ ĐIỆN TỬ
                          </p>
                          <p className="font-sans text-[11px] font-semibold text-indigo-700 mt-1">
                            Mã hồ sơ: {docData.originalCode || "DTT-2026-841"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-sans text-[11px] font-bold text-slate-900 uppercase tracking-tight">
                            {docData.senderOrg?.name || docData.draftUnit?.name || "CƠ QUAN BAN HÀNH"}
                          </p>
                          <p className="font-sans text-[11px] text-slate-700 font-medium">
                            Số:{" "}
                            {docData.documentNumber
                              ? `${docData.documentNumber}/${docData.documentNumberYear}`
                              : docData.originalCode || "---"}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Cột phải: Quốc hiệu, tiêu ngữ */}
                    <div className="col-span-7 text-center space-y-0.5">
                      <p className="font-sans text-[11px] font-bold text-slate-900 uppercase">
                        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                      </p>
                      <p className="font-sans text-[12px] font-bold text-slate-800">
                        Độc lập - Tự do - Hạnh phúc
                      </p>
                      <div className="w-28 h-[1px] bg-slate-800 mx-auto mt-0.5" />
                      <p className="font-sans italic text-[11px] text-slate-500 mt-1.5">
                        {docData.issuedDate
                          ? `Ngày ${new Date(docData.issuedDate).getDate()} tháng ${
                              new Date(docData.issuedDate).getMonth() + 1
                            } năm ${new Date(docData.issuedDate).getFullYear()}`
                          : `Ngày ${new Date().getDate()} tháng ${
                              new Date().getMonth() + 1
                            } năm ${new Date().getFullYear()}`}
                      </p>
                    </div>
                  </div>

                  {/* Tên loại văn bản & Trích yếu */}
                  <div className="text-center py-2 space-y-1">
                    <h2 className="font-sans text-base sm:text-lg font-bold text-slate-900 uppercase tracking-wide">
                      {docData.docType?.name || docData.documentType?.name || "ĐƠN KIẾN NGHỊ / PHẢN ÁNH"}
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-slate-700 max-w-lg mx-auto">
                      V/v: {docData.title}
                    </p>
                  </div>

                  {/* Kính gửi */}
                  <div className="text-xs sm:text-sm space-y-1 pt-1">
                    <p className="font-semibold text-slate-800">
                      Kính gửi:{" "}
                      <span className="font-normal italic">
                        Ủy ban Nhân dân / Cơ quan tiếp nhận và giải quyết thủ tục hành chính
                      </span>
                    </p>
                  </div>

                  {/* Thông tin người nộp đơn / Chủ thể */}
                  <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs font-sans space-y-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Chủ thể nộp / Người gửi:</span>
                        <span className="font-bold text-slate-900">
                          {docData.senderOrg?.name || docData.senderName || "Nguyễn Văn Dân"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Số điện thoại liên hệ:</span>
                        <span className="font-medium text-slate-800">
                          {docData.senderOrg?.phone || "0912.345.678"}
                        </span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 block text-[10px]">Địa chỉ liên hệ:</span>
                        <span className="text-slate-800">
                          {docData.senderOrg?.address || "Toàn quốc"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Nội dung chi tiết */}
                  <div className="space-y-2 pt-1 text-xs sm:text-sm leading-relaxed">
                    <p className="font-sans font-bold text-slate-800 uppercase text-[11px]">
                      Nội dung trình bày & Kiến nghị:
                    </p>
                    <div className="p-3 bg-white rounded border border-slate-200 text-slate-700 whitespace-pre-wrap leading-6 text-justify">
                      {docData.summaryNotes ? (
                        docData.summaryNotes
                      ) : (
                        <>
                          Tôi xin kính gửi đến Cơ quan có thẩm quyền xem xét và giải quyết đối với nội dung sau:
                          <br />
                          <strong>Trích yếu văn bản:</strong> {docData.title}.
                          <br />
                          Kính đề nghị Quý cơ quan xem xét, tiếp nhận vào sổ và giao bộ phận chuyên môn kiểm tra, giải quyết theo đúng thẩm quyền và quy chế công tác văn thư điện tử.
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bút phê chỉ đạo & Tiếp nhận */}
                  <div className="mt-3 p-2.5 bg-amber-50/70 border border-amber-300 rounded font-sans text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px] uppercase">
                      <FileCheck className="h-3.5 w-3.5 text-amber-700" />
                      Ghi nhận tiếp nhận hồ sơ & Bút phê
                    </div>
                    <p className="text-amber-800 text-[11px]">
                      <strong>Văn thư:</strong> Đã tiếp nhận vào Sổ văn bản đến chung (
                      {docData.documentBook?.name || "SVB-DEN"}). Mã hồ sơ:{" "}
                      {docData.originalCode || "DTT-2026-841"}.
                    </p>
                    <p className="text-amber-800 text-[11px]">
                      <strong>Hạn xử lý:</strong>{" "}
                      {docData.processingDeadline
                        ? new Date(docData.processingDeadline).toLocaleDateString("vi-VN")
                        : "Trong vòng 07 ngày làm việc"}
                      .
                    </p>
                  </div>
                </div>

                {/* Phần chân: Chữ ký số và Dấu xác thực */}
                <div className="pt-6 border-t border-slate-200 mt-5 grid grid-cols-2 gap-4 font-sans text-xs">
                  <div>
                    <p className="font-bold text-slate-700 text-[11px] uppercase">Nơi nhận:</p>
                    <ul className="text-[10px] text-slate-600 space-y-0.5 mt-1 list-disc list-inside">
                      <li>Như trên;</li>
                      <li>Bộ phận chuyên môn giải quyết;</li>
                      <li>Lưu: VT, HS (Nghị định 30/2020/NĐ-CP).</li>
                    </ul>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="font-bold text-slate-800 text-[11px] uppercase">
                      {docData.direction === "INCOMING" ? "NGƯỜI LÀM ĐƠN / ĐẠI DIỆN" : "NGƯỜI KÝ PHÁT HÀNH"}
                    </p>

                    {/* Con dấu xác thực số */}
                    <div className="inline-block p-2 bg-red-50 border-2 border-red-500 rounded-lg text-red-700 text-center shadow-xs">
                      <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-600">
                        <CheckCircle2 className="h-3 w-3" />
                        KÝ SỐ ĐIỆN TỬ HỢP LỆ
                      </div>
                      <p className="font-bold text-xs mt-0.5 text-red-800">
                        {docData.senderName || docData.signerName || "Nguyễn Văn Dân"}
                      </p>
                      <p className="text-[9px] text-red-600 mt-0.5 font-mono">
                        {new Date(docData.issuedDate || Date.now()).toLocaleDateString("vi-VN")} - ĐÃ XÁC THỰC
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Tab PDF Viewer */
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-2 overflow-hidden relative">
              {primaryFile ? (
                <iframe
                  src={`/api/files/${primaryFile.id}`}
                  className="w-full h-full border-0 rounded bg-white shadow-xs"
                  title="PDF Viewer"
                />
              ) : (
                <div className="text-center text-slate-400 text-xs">
                  Văn bản này hiện chưa đính kèm file tài liệu.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cột phải (40% ~ 5 cols): Tabs thông tin, Timeline, Handlers */}
        <div className="lg:col-span-5 bg-white rounded border border-slate-200 flex flex-col overflow-hidden shadow-xs">
          {/* Tabs Navigation */}
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 select-none">
            <button
              onClick={() => setActiveTab("info")}
              className={`flex-1 py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === "info"
                  ? "border-indigo-600 text-indigo-600 bg-white"
                  : "border-transparent hover:text-slate-900"
              }`}
            >
              Trích yếu
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`flex-1 py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === "timeline"
                  ? "border-indigo-600 text-indigo-600 bg-white"
                  : "border-transparent hover:text-slate-900"
              }`}
            >
              Luồng xử lý ({auditLogs.length})
            </button>
            <button
              onClick={() => setActiveTab("handlers")}
              className={`flex-1 py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === "handlers"
                  ? "border-indigo-600 text-indigo-600 bg-white"
                  : "border-transparent hover:text-slate-900"
              }`}
            >
              {docData.direction === "INCOMING" ? "Phân công" : "Chuỗi duyệt"}
            </button>
            <button
              onClick={() => setActiveTab("files")}
              className={`flex-1 py-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === "files"
                  ? "border-indigo-600 text-indigo-600 bg-white"
                  : "border-transparent hover:text-slate-900"
              }`}
            >
              File ({docData.files?.length || 0})
            </button>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 overflow-y-auto p-4 text-xs space-y-4">
            {/* TAB 1: THÔNG TIN HÀNH CHÍNH */}
            {activeTab === "info" && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded border border-slate-100 space-y-2">
                  <span className="font-bold text-slate-800 uppercase text-[11px] block">
                    Nội dung trích yếu
                  </span>
                  <p className="text-slate-700 leading-relaxed font-medium">{docData.title}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Hình thức sổ</span>
                    <span className="font-semibold text-slate-800">
                      {docData.documentBook?.name || "Chưa vào sổ"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">Loại văn bản</span>
                    <span className="font-semibold text-slate-800">
                      {docData.documentType?.name || "Khác"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      {docData.direction === "INCOMING" ? "Cơ quan gửi" : "Nơi nhận"}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {docData.senderOrg?.name || docData.senderName || docData.recipientsSummary || "Nội bộ"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      {docData.direction === "INCOMING" ? "Số/ký hiệu gốc" : "Người ký"}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {docData.originalCode || docData.signerName || "Chưa có"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">Ngày văn bản</span>
                    <span className="font-semibold text-slate-800">
                      {docData.issuedDate
                        ? new Date(docData.issuedDate).toLocaleDateString("vi-VN")
                        : "Chưa ghi nhận"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">Hạn xử lý</span>
                    <span className="font-semibold text-slate-800">
                      {docData.processingDeadline
                        ? new Date(docData.processingDeadline).toLocaleDateString("vi-VN")
                        : "Không đặt hạn"}
                    </span>
                  </div>
                </div>

                {docData.summaryNotes && (
                  <div className="p-3 bg-amber-50/50 rounded border border-amber-200/60 text-amber-900">
                    <span className="font-bold block text-[10px] text-amber-800 uppercase">Ghi chú</span>
                    <p className="mt-0.5">{docData.summaryNotes}</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TIMELINE AUDIT TRAIL */}
            {activeTab === "timeline" && (
              <div className="space-y-4">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                  Nhật ký kiểm toán bất biến (Append-Only)
                </span>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {auditLogs.map((log, index) => (
                    <div key={log.id} className="relative group">
                      <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-indigo-600 ring-4 ring-white" />
                      <div className="bg-slate-50 border border-slate-200/80 rounded p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{log.action}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.createdAt).toLocaleString("vi-VN")}
                          </span>
                        </div>
                        <p className="text-slate-600">{log.reason || "Cập nhật dữ liệu"}</p>
                        <span className="text-[10px] text-indigo-600 font-medium block">
                          Bởi: {log.actor?.fullName} ({log.actor?.employeeCode})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: PHÂN CÔNG / LUỒNG DUYỆT */}
            {activeTab === "handlers" && (
              <div className="space-y-3">
                {docData.direction === "INCOMING" ? (
                  <>
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <span className="font-bold text-slate-800 uppercase text-[11px]">
                        Danh sách chuyên viên thụ lý
                      </span>
                    </div>

                    {docData.handlers?.length === 0 ? (
                      <p className="text-slate-400 text-center py-6 italic">
                        Chưa phân công cán bộ thụ lý
                      </p>
                    ) : (
                      docData.handlers?.map((h: any) => (
                        <div
                          key={h.id}
                          className={`p-3 rounded border space-y-1.5 ${
                            h.role === "MAIN"
                              ? "bg-indigo-50/40 border-indigo-200"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                              {h.assignee.fullName}
                              <Badge variant={h.role === "MAIN" ? "info" : "secondary"}>
                                {h.role === "MAIN" ? "Chủ trì" : h.role === "COORDINATE" ? "Phối hợp" : "Để biết"}
                              </Badge>
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">
                              {h.status}
                            </span>
                          </div>

                          {h.instruction && (
                            <p className="text-slate-600 italic">"Ý kiến: {h.instruction}"</p>
                          )}

                          {h.reportContent && (
                            <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-emerald-900 mt-2">
                              <span className="font-bold block text-[10px] text-emerald-800">
                                Báo cáo kết quả:
                              </span>
                              <p className="mt-0.5">{h.reportContent}</p>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-bold text-slate-800 uppercase text-[11px] block">
                      Chuỗi duyệt nối tiếp
                    </span>
                    {docData.approvals?.map((app: any) => (
                      <div key={app.id} className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            Bước {app.stepOrder}: {app.approver?.fullName}
                          </span>
                          <Badge variant={app.status === "APPROVED" ? "success" : "warning"}>
                            {app.status}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-slate-500 block">Vai trò: {app.role}</span>
                        {app.comment && <p className="text-slate-600 italic">"Ý kiến: {app.comment}"</p>}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* TAB 4: FILES & PHIÊN BẢN */}
            {activeTab === "files" && (
              <div className="space-y-3">
                <span className="font-bold text-slate-800 uppercase text-[11px] block">
                  Lịch sử các phiên bản tài liệu
                </span>
                {docData.files?.map((f: any) => (
                  <div key={f.id} className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{f.fileName}</span>
                      <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">
                        v{f.version}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 block truncate">
                      SHA-256: {f.fileHash}
                    </span>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500">
                        {(f.fileSize / 1024).toFixed(1)} KB • {f.uploader?.fullName}
                      </span>
                      <a
                        href={`/api/files/${f.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline font-medium text-[11px]"
                      >
                        Tải file
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog Xác nhận Thực hiện Action */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleExecuteAction}
        isLoading={isActionLoading}
        title={`Xác nhận: ${selectedAction?.label}`}
        description={
          selectedAction?.requiresReason
            ? "Thao tác này bắt buộc phải ghi rõ lý do vào ô bên dưới:"
            : "Bạn có chắc chắn muốn thực hiện thao tác chuyển trạng thái này không?"
        }
        confirmText={selectedAction?.label || "Đồng ý"}
        variant={
          selectedAction?.action.includes("REJECT") || selectedAction?.action.includes("RETURN") || selectedAction?.action === "CANCEL"
            ? "danger"
            : "primary"
        }
      />

      {/* Drawer: Nộp báo cáo kết quả */}
      <Drawer
        isOpen={isReportDrawerOpen}
        onClose={() => setIsReportDrawerOpen(false)}
        title="Nộp báo cáo kết quả xử lý"
        description="Báo cáo tiến độ và kết quả thụ lý văn bản đến cho Trưởng phòng/Lãnh đạo"
      >
        <form onSubmit={handleNopBaoCao} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nội dung kết quả xử lý *
            </label>
            <textarea
              rows={6}
              required
              value={reportContent}
              onChange={(e) => setReportContent(e.target.value)}
              placeholder="VD: Đã hoàn thành dự thảo văn bản trả lời số 14/CV-TCHC, đã thẩm định hồ sơ theo đúng thời hạn quy định..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200">
            <Button variant="outline" type="button" onClick={() => setIsReportDrawerOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" isLoading={isActionLoading}>
              Gửi báo cáo kết quả
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
