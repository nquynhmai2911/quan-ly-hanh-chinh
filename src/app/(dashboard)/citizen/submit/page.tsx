"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentStatusBadge } from "@/components/ui/badge";
import { DocumentStatus } from "@prisma/client";
import { toast } from "sonner";

type Submission = {
  id: string;
  title: string;
  status: DocumentStatus;
  createdAt: string;
  workflow: { trackingCode: string };
  files: { id: string; fileName: string; fileSize: number }[];
};
const inputStyle = "w-full px-3 py-2 border border-slate-300 rounded text-sm";
const initialForm = {
  senderName: "",
  senderPhone: "",
  senderEmail: "",
  senderAddress: "",
  docType: "Đơn kiến nghị / Phản ánh",
  urgency: "NORMAL",
  title: "",
  note: "",
};
export default function CitizenSubmitPage() {
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    id: string;
    onlineCode: string;
  } | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [canSubmit, setCanSubmit] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<Array<{ id: string; name: string; code: string }>>([]);
  async function loadHistory() {
    try {
      const json = await (await fetch("/api/citizen/submit-document")).json();
      if (!json.success)
        throw new Error(json.error?.message || "Không tải được hồ sơ đã nộp.");
      setSubmissions(json.data);
      setHistoryError("");
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : "Không tải được hồ sơ.");
    }
  }
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setCanSubmit(
            j.data.roles.some((r: string) => ["CITIZEN", "ADMIN"].includes(r)),
          );
          setForm((prev) => ({
            ...prev,
            senderName: j.data.user.fullName,
            senderEmail: j.data.user.email,
          }));
        }
      });
    fetch("/api/catalogs/document-types")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data) && j.data.length > 0) {
          setAvailableTypes(j.data);
          setForm((prev) => {
            const hasMatch = j.data.some((t: { name: string }) => t.name === prev.docType);
            return hasMatch ? prev : { ...prev, docType: j.data[0].name };
          });
        }
      })
      .catch(() => {});

    const controller = new AbortController();
    fetch("/api/citizen/submit-document", { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (!json.success)
          throw new Error(
            json.error?.message || "Không tải được hồ sơ đã nộp.",
          );
        setSubmissions(json.data);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setHistoryError(
            error instanceof Error ? error.message : "Không tải được hồ sơ.",
          );
      });
    return () => controller.abort();
  }, []);
  function chooseFiles(selected: FileList | null) {
    if (!selected) return;
    const next = [...files, ...Array.from(selected)];
    if (next.length > 10) {
      toast.error("Mỗi hồ sơ tối đa 10 tệp.");
      return;
    }
    if (next.some((f) => f.size > 25 * 1024 * 1024)) {
      toast.error("Mỗi tệp tối đa 25 MB.");
      return;
    }
    setFiles(next);
    setError("");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) {
      setError("Vui lòng đính kèm ít nhất một tệp gốc.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const attachments: { uploadId: string }[] = [];
      for (const file of files) {
        const data = new FormData();
        data.append("file", file);
        const response = await fetch("/api/upload", {
          method: "POST",
          body: data,
        });
        const json = await response.json();
        if (!response.ok || !json.success || !json.data.uploadId)
          throw new Error(
            `Không tải được tệp “${file.name}”: ${json.error?.message || "Vui lòng thử lại."}`,
          );
        attachments.push({ uploadId: json.data.uploadId });
      }
      const response = await fetch("/api/citizen/submit-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, attachments }),
      });
      const json = await response.json();
      if (!response.ok || !json.success)
        throw new Error(json.error?.message || "Không thể nộp hồ sơ.");
      setResult(json.data);
      setFiles([]);
      await loadHistory();
      toast.success("Đã lưu hồ sơ và toàn bộ tệp đính kèm.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không kết nối được máy chủ.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      <div className="bg-indigo-900 text-white rounded-lg p-6">
        <h1 className="text-xl font-bold">Nộp văn bản đến qua dịch vụ công</h1>
        <p className="mt-2 text-sm text-indigo-100">
          Hồ sơ được gửi đến văn thư để tiếp nhận, vào sổ và chuyển xử lý. Bạn
          có thể theo dõi hồ sơ đã nộp ở bên dưới.
        </p>
      </div>
      {result ? (
        <div className="border border-emerald-300 bg-emerald-50 rounded p-6 space-y-3">
          <h2 className="font-bold">Đã nộp hồ sơ thành công</h2>
          <p>
            Mã tra cứu: <strong>{result.onlineCode}</strong>
          </p>
          <p>Trạng thái: Chờ tiếp nhận</p>
          <div className="flex gap-3">
            <Link
              className="text-indigo-700 underline"
              href={`/documents/${result.id}`}
            >
              Xem hồ sơ và tệp đã nộp
            </Link>
            <button
              className="text-indigo-700 underline"
              onClick={() => {
                setResult(null);
                setForm((prev) => ({ ...prev, title: "", note: "" }));
              }}
            >
              Nộp hồ sơ khác
            </button>
          </div>
        </div>
      ) : canSubmit ? (
        <form
          onSubmit={submit}
          className="space-y-5 bg-white border rounded-lg p-6"
        >
          <h2 className="font-semibold">Thông tin người gửi</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm">
              Họ tên hoặc tên tổ chức *
              <input
                required
                minLength={2}
                maxLength={255}
                className={inputStyle}
                value={form.senderName}
                onChange={(e) =>
                  setForm({ ...form, senderName: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              Số điện thoại *
              <input
                required
                minLength={7}
                maxLength={30}
                className={inputStyle}
                value={form.senderPhone}
                onChange={(e) =>
                  setForm({ ...form, senderPhone: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              Thư điện tử liên hệ
              <input
                type="email"
                className={inputStyle}
                value={form.senderEmail}
                onChange={(e) =>
                  setForm({ ...form, senderEmail: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              Địa chỉ liên hệ
              <input
                maxLength={500}
                className={inputStyle}
                value={form.senderAddress}
                onChange={(e) =>
                  setForm({ ...form, senderAddress: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              Loại hồ sơ
              <select
                className={inputStyle}
                value={form.docType}
                onChange={(e) => setForm({ ...form, docType: e.target.value })}
              >
                {availableTypes.length > 0
                  ? availableTypes.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name} ({t.code})
                      </option>
                    ))
                  : [
                      "Đơn kiến nghị / Phản ánh",
                      "Đơn đề nghị giải quyết thủ tục",
                      "Công văn đề xuất",
                      "Báo cáo tình hình",
                      "Khác",
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
              </select>
            </label>
            <label className="text-sm">
              Độ khẩn
              <select
                className={inputStyle}
                value={form.urgency}
                onChange={(e) => setForm({ ...form, urgency: e.target.value })}
              >
                <option value="NORMAL">Bình thường</option>
                <option value="URGENT">Khẩn</option>
                <option value="FIRE">Hỏa tốc</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Trích yếu nội dung *
            <textarea
              required
              minLength={5}
              maxLength={1000}
              rows={3}
              className={inputStyle}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Thông tin bổ sung
            <textarea
              maxLength={1000}
              rows={3}
              className={inputStyle}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          <div className="border border-dashed rounded p-4 space-y-3">
            <label className="block text-sm font-semibold">
              Tệp đính kèm *
              <input
                type="file"
                multiple
                disabled={busy}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                className="block mt-2 text-sm"
                onChange={(e) => {
                  chooseFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-xs text-slate-500">
              Tối đa 10 tệp, mỗi tệp 25 MB. Hỗ trợ PDF, tài liệu Word, bảng tính
              và ảnh.
            </p>
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li
                  key={`${i}-${f.name}`}
                  className="flex justify-between text-sm gap-2"
                >
                  <span>
                    {f.name} · {(f.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    className="text-red-600"
                    onClick={() =>
                      setFiles((old) => old.filter((_, index) => index !== i))
                    }
                  >
                    Bỏ tệp
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" isLoading={busy}>
            Gửi hồ sơ đến cơ quan
          </Button>
        </form>
      ) : (
        <p>
          Chức năng nộp hồ sơ dành cho tài khoản người dân. Văn thư tiếp nhận hồ
          sơ trong danh sách văn bản đến.
        </p>
      )}
      <section className="bg-white border rounded-lg p-6 space-y-4">
        <h2 className="font-bold">Hồ sơ đã nộp</h2>
        {historyError && (
          <p role="alert" className="text-red-700">
            {historyError}
          </p>
        )}
        {!submissions.length && !historyError && <p>Chưa có hồ sơ đã nộp.</p>}
        {submissions.map((doc) => (
          <article key={doc.id} className="border rounded p-4 space-y-2">
            <div className="flex justify-between gap-2">
              <Link
                className="font-semibold text-indigo-700"
                href={`/documents/${doc.id}`}
              >
                {doc.title}
              </Link>
              <DocumentStatusBadge status={doc.status} />
            </div>
            <p className="text-xs text-slate-500">
              {doc.workflow.trackingCode} ·{" "}
              {new Date(doc.createdAt).toLocaleString("vi-VN")}
            </p>
            <ul className="text-sm space-y-1">
              {doc.files.map((f) => (
                <li key={f.id}>
                  <a
                    className="text-indigo-600 underline"
                    href={`/api/files/${f.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {f.fileName}
                  </a>{" "}
                  · {(f.fileSize / 1024).toFixed(1)} KB
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
}
