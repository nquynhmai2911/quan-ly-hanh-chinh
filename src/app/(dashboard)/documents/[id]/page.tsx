// src/app/(dashboard)/documents/[id]/page.tsx
// Màn hình Chi tiết Văn bản dạng Split-screen: Trái 60% File Viewer, Phải 40% Tabs & Timeline

"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Badge,
  DocumentStatusBadge,
  UrgencyBadge,
  SecurityBadge,
} from "@/components/ui/badge";
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
import { IncomingActionDrawer } from "@/components/documents/incoming-action-drawer";
import { AssignmentDrawer } from "@/components/documents/assignment-drawer";
import {
  actionLabel,
  roleLabels,
  processingLabels,
} from "@/lib/display-labels";
import { toast } from "sonner";
import { AllowedAction } from "@/modules/document/state-machine";
import type { DocumentStatus, SecurityLevel, UrgencyLevel } from "@prisma/client";

interface DocumentFileItem {
  id: string;
  fileName: string;
  fileSize: number;
  fileHash: string | null;
  version: number;
  mimeType: string | null;
  uploader?: { fullName: string } | null;
}

interface DocumentHandlerItem {
  id: string;
  role: string;
  status: string;
  instruction: string | null;
  reportContent: string | null;
  assignee: { fullName: string };
}

interface DocumentApprovalItem {
  id: string;
  role: string;
  status: string;
  stepOrder: number;
  comment: string | null;
  approver?: { fullName: string } | null;
}

interface DocumentDetail {
  id: string;
  direction: "INCOMING" | "OUTGOING";
  title: string;
  documentNumber: string | null;
  originalCode: string | null;
  status: DocumentStatus;
  urgency: UrgencyLevel;
  security: SecurityLevel;
  issuedDate: string | null;
  processingDeadline: string | null;
  senderName: string | null;
  senderOrg?: { name: string } | null;
  signerName: string | null;
  recipientsSummary: string | null;
  summaryNotes: string | null;
  documentBook?: { name: string } | null;
  documentType?: { name: string } | null;
  workflow?: {
    instruction: string | null;
    trackingCode: string | null;
    leader?: { fullName: string } | null;
    head?: { fullName: string } | null;
    unit?: { name: string } | null;
  } | null;
  files?: DocumentFileItem[];
  handlers?: DocumentHandlerItem[];
  approvals?: DocumentApprovalItem[];
}

interface AuditLogItem {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  actor?: { fullName: string; employeeCode: string } | null;
}

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id: docId } = use(params);

  const [docData, setDocData] = useState<DocumentDetail | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [allowedActions, setAllowedActions] = useState<AllowedAction[]>([]);
  const [activeTab, setActiveTab] = useState<
    "info" | "timeline" | "handlers" | "files"
  >("info");
  const [previewMode, setPreviewMode] = useState<"doc" | "pdf">("pdf");
  const [isLoading, setIsLoading] = useState(true);

  // Action states
  const [selectedAction, setSelectedAction] = useState<AllowedAction | null>(
    null,
  );
  const [actionReason, setActionReason] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [canReport, setCanReport] = useState(false);
  const [incomingAction, setIncomingAction] = useState<AllowedAction | null>(
    null,
  );
  const [canAssign, setCanAssign] = useState(false);
  const [canAttach, setCanAttach] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState("");
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
      if (res.status === 404) {
        res = await fetch(`/api/documents/outgoing/${docId}`);
      }
      const json = await res.json();
      if (json.success) {
        setDocData(json.data.document);
        setCanAssign(!!json.data.canAssign);
        setCanAttach(!!json.data.canAttach);
        setCanReport(!!json.data.canReport);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDocumentDetail();
  }, [docId]);

  function handleTriggerAction(action: AllowedAction) {
    if (action.action === "DEPT_HEAD_ASSIGN") {
      setIsAssignDrawerOpen(true);
      return;
    }
    if (docData?.direction === "INCOMING") {
      setIncomingAction(action);
      return;
    }
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
      if (
        selectedAction.action === "LEADER_APPROVE" &&
        docData?.direction === "OUTGOING"
      ) {
        const signRes = await fetch(`/api/documents/outgoing/${docId}/sign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const signJson = await signRes.json();
        if (!signRes.ok || !signJson.success) {
          toast.error(signJson.error?.message || "Phê duyệt điện tử thất bại.");
          return;
        }
        toast.success("Phê duyệt điện tử thành công!");
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

  async function attachFile(file: File) {
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(
        `/api/documents/${docData?.direction === "INCOMING" ? "incoming" : "outgoing"}/${docId}/files`,
        { method: "POST", body: form },
      );
      const json = await response.json();
      if (!response.ok || !json.success)
        throw new Error(json.error?.message || "Không thể đính kèm tệp.");
      setSelectedFileId(json.data.id);
      setPreviewMode("pdf");
      setActiveTab("files");
      toast.success("Đã đính kèm tệp gốc.");
      await fetchDocumentDetail();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể tải tệp lên.",
      );
    } finally {
      setIsUploading(false);
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

  const primaryFile =
    docData.files?.find((file: { id: string }) => file.id === selectedFileId) ||
    docData.files?.[0];

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] space-y-3">
      {/* Top Header Bar */}
      <div className="bg-white rounded border border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                {docData.documentNumber ||
                  docData.originalCode ||
                  "Chưa cấp số"}
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
          {canReport && (
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

          {canAssign &&
            !allowedActions.some(
              (act) => act.action === "DEPT_HEAD_ASSIGN",
            ) && (
              <Button size="sm" onClick={() => setIsAssignDrawerOpen(true)}>
                Phân công xử lý
              </Button>
            )}
          {allowedActions.map((act) => (
            <Button
              key={act.action}
              size="sm"
              variant={
                act.action.includes("REJECT") ||
                act.action.includes("RETURN") ||
                act.action === "CANCEL"
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
                Thông tin văn bản
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
                Tệp đính kèm ({docData.files?.length || 0})
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
                    title="Mở trong cửa sổ mới"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Mở trong cửa sổ mới
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

          {previewMode === "pdf" && (
            <div className="p-2 border-b flex flex-wrap items-center gap-2 text-sm">
              {docData.files && docData.files.length > 0 && (
                <select
                  aria-label="Chọn tệp để xem"
                  className="border rounded p-1 min-w-0 max-w-full"
                  value={primaryFile?.id || ""}
                  onChange={(e) => setSelectedFileId(e.target.value)}
                >
                  {docData.files.map(
                    (file: { id: string; fileName: string }) => (
                      <option key={file.id} value={file.id}>
                        {file.fileName}
                      </option>
                    ),
                  )}
                </select>
              )}
              {canAttach && (
                <label className="cursor-pointer text-indigo-700 font-semibold">
                  {isUploading ? "Đang tải tệp lên…" : "Bổ sung tệp đính kèm"}
                  <input
                    aria-label="Bổ sung tệp đính kèm"
                    type="file"
                    className="sr-only"
                    disabled={isUploading}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void attachFile(file);
                    }}
                  />
                </label>
              )}
            </div>
          )}
          {/* Vùng nội dung xem */}
          {previewMode === "doc" ? (
            <div className="p-6 space-y-4 overflow-auto text-sm">
              <h2 className="text-lg font-semibold">Thông tin văn bản</h2>
              <p>
                <strong>Trích yếu:</strong> {docData.title}
              </p>
              <p>
                <strong>Nơi gửi:</strong>{" "}
                {docData.senderName || "Chưa ghi nhận"}
              </p>
              <p>
                <strong>Số văn bản:</strong>{" "}
                {docData.documentNumber || "Chưa vào sổ"}
              </p>
              <p>
                <strong>Lãnh đạo nhận trình:</strong>{" "}
                {docData.workflow?.leader?.fullName || "Chưa trình"}
              </p>
              <p>
                <strong>Phòng ban xử lý:</strong>{" "}
                {docData.workflow?.unit?.name || "Chưa phân phối"}
              </p>
              <p>
                <strong>Trưởng phòng phụ trách:</strong>{" "}
                {docData.workflow?.head?.fullName || "Chưa phân phối"}
              </p>
              {docData.workflow?.instruction && (
                <p className="whitespace-pre-wrap">
                  <strong>Ý kiến chỉ đạo:</strong>{" "}
                  {docData.workflow.instruction}
                </p>
              )}
              {docData.summaryNotes && (
                <p className="whitespace-pre-wrap">
                  <strong>Ghi chú:</strong> {docData.summaryNotes}
                </p>
              )}
              {docData.workflow?.trackingCode && (
                <p>
                  <strong>Mã tra cứu:</strong> {docData.workflow.trackingCode}
                </p>
              )}
              <p className="text-slate-500">
                Nội dung gốc nằm trong các tệp đính kèm.
              </p>
            </div>
          ) : (
            /* Tab PDF Viewer */
            <div className="flex-1 bg-slate-100 flex items-center justify-center p-2 overflow-hidden relative">
              {primaryFile &&
              (primaryFile.mimeType === "application/pdf" ||
                primaryFile.mimeType?.startsWith("image/")) ? (
                <iframe
                  src={`/api/files/${primaryFile.id}`}
                  className="w-full h-full border-0 rounded bg-white shadow-xs"
                  title={primaryFile.fileName}
                />
              ) : primaryFile ? (
                <div className="text-center text-sm space-y-3">
                  <p>{primaryFile.fileName}</p>
                  <p>Định dạng này cần mở bằng ứng dụng trên máy.</p>
                  <a
                    className="text-indigo-600 underline"
                    href={`/api/files/${primaryFile.id}`}
                    download={primaryFile.fileName}
                  >
                    Tải tệp gốc
                  </a>
                </div>
              ) : (
                <div className="text-center text-slate-400 text-xs">
                  Văn bản này hiện chưa đính kèm tệp tài liệu.
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
              Tệp đính kèm ({docData.files?.length || 0})
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
                  <p className="text-slate-700 leading-relaxed font-medium">
                    {docData.title}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Hình thức sổ
                    </span>
                    <span className="font-semibold text-slate-800">
                      {docData.documentBook?.name || "Chưa vào sổ"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Loại văn bản
                    </span>
                    <span className="font-semibold text-slate-800">
                      {docData.documentType?.name || "Khác"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      {docData.direction === "INCOMING"
                        ? "Cơ quan gửi"
                        : "Nơi nhận"}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {docData.senderOrg?.name ||
                        docData.senderName ||
                        docData.recipientsSummary ||
                        "Nội bộ"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      {docData.direction === "INCOMING"
                        ? "Số/ký hiệu gốc"
                        : "Người ký"}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {docData.originalCode || docData.signerName || "Chưa có"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Ngày văn bản
                    </span>
                    <span className="font-semibold text-slate-800">
                      {docData.issuedDate
                        ? new Date(docData.issuedDate).toLocaleDateString(
                            "vi-VN",
                          )
                        : "Chưa ghi nhận"}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">
                      Hạn xử lý
                    </span>
                    <span className="font-semibold text-slate-800">
                      {docData.processingDeadline
                        ? new Date(
                            docData.processingDeadline,
                          ).toLocaleDateString("vi-VN")
                        : "Không đặt hạn"}
                    </span>
                  </div>
                </div>

                {docData.summaryNotes && (
                  <div className="p-3 bg-amber-50/50 rounded border border-amber-200/60 text-amber-900">
                    <span className="font-bold block text-[10px] text-amber-800 uppercase">
                      Ghi chú
                    </span>
                    <p className="mt-0.5">{docData.summaryNotes}</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TIMELINE AUDIT TRAIL */}
            {activeTab === "timeline" && (
              <div className="space-y-4">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
                  Lịch sử xử lý văn bản
                </span>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {auditLogs.map((log, index) => (
                    <div key={log.id} className="relative group">
                      <div className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-indigo-600 ring-4 ring-white" />
                      <div className="bg-slate-50 border border-slate-200/80 rounded p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            {actionLabel(log.action)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.createdAt).toLocaleString("vi-VN")}
                          </span>
                        </div>
                        <p className="text-slate-600">
                          {log.reason || "Cập nhật dữ liệu"}
                        </p>
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
                      docData.handlers?.map((h) => (
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
                              <Badge
                                variant={
                                  h.role === "MAIN" ? "info" : "secondary"
                                }
                              >
                                {h.role === "MAIN"
                                  ? "Chủ trì"
                                  : h.role === "COORDINATE"
                                    ? "Phối hợp"
                                    : "Để biết"}
                              </Badge>
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">
                              {processingLabels[h.status] || "Đang xử lý"}
                            </span>
                          </div>

                          {h.instruction && (
                            <p className="text-slate-600 italic">
                              &quot;Ý kiến: {h.instruction as string}&quot;
                            </p>
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
                    {docData.approvals?.map((app) => (
                      <div
                        key={app.id}
                        className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            Bước {app.stepOrder}: {app.approver?.fullName}
                          </span>
                          <Badge
                            variant={
                              app.status === "APPROVED" ? "success" : "warning"
                            }
                          >
                            {processingLabels[app.status] || "Chờ xử lý"}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Vai trò: {roleLabels[app.role] || "Người duyệt"}
                        </span>
                        {app.comment && (
                          <p className="text-slate-600 italic">
                            &quot;Ý kiến: {app.comment as string}&quot;
                          </p>
                        )}
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
                {!docData.files?.length && (
                  <p>
                    Chưa có tệp đính kèm. Sử dụng “Bổ sung tệp đính kèm” để tải
                    tệp gốc lên.
                  </p>
                )}
                {docData.files?.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        {f.fileName}
                      </span>
                      <span className="font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">
                        Phiên bản {f.version}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 block truncate">
                      SHA-256: {f.fileHash}
                    </span>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500">
                        {(f.fileSize / 1024).toFixed(1)} KB •{" "}
                        {f.uploader?.fullName}
                      </span>
                      <a
                        href={`/api/files/${f.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline font-medium text-[11px]"
                      >
                        Tải tệp
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
          selectedAction?.action.includes("REJECT") ||
          selectedAction?.action.includes("RETURN") ||
          selectedAction?.action === "CANCEL"
            ? "danger"
            : "primary"
        }
      >
        {selectedAction?.requiresReason && (
          <label className="block text-sm">
            Lý do *
            <textarea
              className="w-full border rounded p-2"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              maxLength={1000}
            />
          </label>
        )}
      </ConfirmDialog>

      {incomingAction && (
        <IncomingActionDrawer
          action={incomingAction}
          documentId={docId}
          onClose={() => setIncomingAction(null)}
          onSaved={fetchDocumentDetail}
        />
      )}
      {isAssignDrawerOpen && (
        <AssignmentDrawer
          open={true}
          onClose={() => setIsAssignDrawerOpen(false)}
          documentId={docId}
          onSaved={fetchDocumentDetail}
        />
      )}
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
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsReportDrawerOpen(false)}
            >
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
