// src/components/documents/document-edit-drawer.tsx
// Drawer Chỉnh sửa Thông tin Văn bản (Áp dụng cho cả Văn bản đến và Văn bản đi)

"use client";

import React, { useState, useEffect } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileText,
  Calendar,
  Building2,
  Shield,
  Clock,
  Send,
  Save,
  User,
} from "lucide-react";
import type { UrgencyLevel, SecurityLevel } from "@prisma/client";

export interface EditableDocument {
  id: string;
  direction?: "INCOMING" | "OUTGOING";
  title: string;
  documentNumber?: string | null;
  originalCode?: string | null;
  senderName?: string | null;
  recipientsSummary?: string | null;
  signerName?: string | null;
  signerPosition?: string | null;
  urgency: UrgencyLevel;
  security: SecurityLevel;
  issuedDate?: string | null;
  processingDeadline?: string | null;
  summaryNotes?: string | null;
}

interface DocumentEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  document: EditableDocument | null;
  onSaved: () => void;
}

export function DocumentEditDrawer({
  isOpen,
  onClose,
  document,
  onSaved,
}: DocumentEditDrawerProps) {
  const [title, setTitle] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [originalCode, setOriginalCode] = useState("");
  const [senderName, setSenderName] = useState("");
  const [recipientsSummary, setRecipientsSummary] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerPosition, setSignerPosition] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("NORMAL");
  const [security, setSecurity] = useState<SecurityLevel>("NORMAL");
  const [issuedDate, setIssuedDate] = useState("");
  const [processingDeadline, setProcessingDeadline] = useState("");
  const [summaryNotes, setSummaryNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (document) {
      setTitle(document.title || "");
      setDocumentNumber(document.documentNumber || "");
      setOriginalCode(document.originalCode || "");
      setSenderName(document.senderName || "");
      setRecipientsSummary(document.recipientsSummary || "");
      setSignerName(document.signerName || "");
      setSignerPosition(document.signerPosition || "");
      setUrgency(document.urgency || "NORMAL");
      setSecurity(document.security || "NORMAL");
      setIssuedDate(
        document.issuedDate
          ? new Date(document.issuedDate).toISOString().split("T")[0]
          : "",
      );
      setProcessingDeadline(
        document.processingDeadline
          ? new Date(document.processingDeadline).toISOString().split("T")[0]
          : "",
      );
      setSummaryNotes(document.summaryNotes || "");
    }
  }, [document]);

  if (!isOpen || !document) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) {
      toast.error("Trích yếu nội dung văn bản phải từ 3 ký tự trở lên.");
      return;
    }

    try {
      setIsSaving(true);
      const res = await fetch(`/api/documents/${document!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          documentNumber: documentNumber.trim() || null,
          originalCode: originalCode.trim() || null,
          senderName: senderName.trim() || null,
          recipientsSummary: recipientsSummary.trim() || null,
          signerName: signerName.trim() || null,
          signerPosition: signerPosition.trim() || null,
          urgency,
          security,
          issuedDate: issuedDate ? `${issuedDate}T00:00:00.000Z` : null,
          processingDeadline: processingDeadline
            ? `${processingDeadline}T23:59:59.000Z`
            : null,
          summaryNotes: summaryNotes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Không thể cập nhật văn bản.");
      }

      toast.success("Đã cập nhật thông tin văn bản thành công!");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Lỗi khi lưu thông tin văn bản.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const inputStyle =
    "w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none";

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Chỉnh sửa thông tin văn bản"
      description={`Cập nhật dữ liệu cho văn bản: ${document.documentNumber || document.originalCode || document.title.slice(0, 30)}`}
      width="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* 1. Trích yếu */}
        <div>
          <label className="block text-xs font-semibold text-slate-800 mb-1">
            Trích yếu nội dung văn bản *
          </label>
          <textarea
            required
            rows={3}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nhập nội dung trích yếu của văn bản..."
            className={`${inputStyle} leading-relaxed`}
          />
        </div>

        {/* 2. Số đến & Ký hiệu gốc */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Số văn bản / Số đến
            </label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              placeholder="VD: 16 hoặc 16/QĐ-UBND"
              className={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Số / Ký hiệu gốc
            </label>
            <input
              type="text"
              value={originalCode}
              onChange={(e) => setOriginalCode(e.target.value)}
              placeholder="VD: DTT-2026-418 hoặc 263"
              className={inputStyle}
            />
          </div>
        </div>

        {/* 3. Cơ quan gửi & Nơi nhận */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-indigo-600" />
              Cơ quan / Người gửi
            </label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="VD: UBND Thành phố, Nguyễn Văn Dân..."
              className={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Send className="h-3.5 w-3.5 text-emerald-600" />
              Nơi nhận / Đơn vị phối hợp
            </label>
            <input
              type="text"
              value={recipientsSummary}
              onChange={(e) => setRecipientsSummary(e.target.value)}
              placeholder="VD: Ban Giám đốc, Phòng TC-HC..."
              className={inputStyle}
            />
          </div>
        </div>

        {/* 4. Thông tin người ký (nếu là VB Đi hoặc có người ký) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-slate-500" />
              Người ký
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="VD: Lãnh đạo ký duyệt"
              className={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chức vụ người ký
            </label>
            <input
              type="text"
              value={signerPosition}
              onChange={(e) => setSignerPosition(e.target.value)}
              placeholder="VD: Giám đốc"
              className={inputStyle}
            />
          </div>
        </div>

        {/* 5. Độ khẩn & Độ mật */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Độ khẩn
            </label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
              className={inputStyle}
            >
              <option value="NORMAL">Thường</option>
              <option value="URGENT">Khẩn</option>
              <option value="FIRE">Hỏa tốc</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-rose-500" />
              Độ mật
            </label>
            <select
              value={security}
              onChange={(e) => setSecurity(e.target.value as SecurityLevel)}
              className={inputStyle}
            >
              <option value="NORMAL">Thường</option>
              <option value="CONFIDENTIAL">Mật</option>
              <option value="TOP_SECRET">Tuyệt mật</option>
            </select>
          </div>
        </div>

        {/* 6. Ngày văn bản & Hạn xử lý */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-indigo-500" />
              Ngày văn bản
            </label>
            <input
              type="date"
              value={issuedDate}
              onChange={(e) => setIssuedDate(e.target.value)}
              className={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-rose-500" />
              Hạn xử lý
            </label>
            <input
              type="date"
              value={processingDeadline}
              onChange={(e) => setProcessingDeadline(e.target.value)}
              className={inputStyle}
            />
          </div>
        </div>

        {/* 7. Ghi chú tóm tắt */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Ghi chú / Tóm tắt nội dung
          </label>
          <textarea
            rows={3}
            value={summaryNotes}
            onChange={(e) => setSummaryNotes(e.target.value)}
            placeholder="Nội dung ghi chú hoặc lưu ý đặc biệt..."
            className={inputStyle}
          />
        </div>

        {/* Nút thao tác chân Drawer */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Hủy
          </Button>
          <Button type="submit" isLoading={isSaving} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Lưu thay đổi
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

