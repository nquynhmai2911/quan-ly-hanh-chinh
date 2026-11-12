"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DocumentStatusBadge } from "@/components/ui/badge";
import { DocumentStatus } from "@prisma/client";
import { toast } from "sonner";
import { Sparkles, Eye, EyeOff, FileText, Send } from "lucide-react";

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

const ADMINISTRATIVE_TEMPLATES = [
  {
    label: "📋 Mẫu Tờ trình (Nghị định 30)",
    docType: "Tờ trình",
    title: "Tờ trình về việc đề xuất phê duyệt kế hoạch công tác và giải quyết công việc",
    note: `Kính gửi: Ban Giám đốc và Lãnh đạo Cơ quan / Phòng ban chuyên môn

I. CĂN CỨ VÀ SỰ CẦN THIẾT
- Căn cứ chức năng, nhiệm vụ và tình hình thực tế triển khai công việc;
- Căn cứ nhu cầu giải quyết công việc hành chính và nâng cao hiệu quả công tác.

II. NỘI DUNG ĐỀ XUẤT, KIẾN NGHỊ
1. Mục tiêu và phạm vi thực hiện:
- Đề xuất cơ quan xem xét, tạo điều kiện phê duyệt chủ trương thực hiện nội dung công việc.
2. Nội dung cụ thể và các phương án triển khai:
- Phương án triển khai chi tiết: ...
- Kinh phí / nguồn lực dự kiến: ...

III. DỰ KIẾN KẾT QUẢ VÀ THỜI GIAN THỰC HIỆN
- Thời gian hoàn thành dự kiến: Trong tháng tới.
- Kính trình Ban Giám đốc và Lãnh đạo cơ quan xem xét, phê duyệt để triển khai.`,
  },
  {
    label: "📝 Mẫu Đơn kiến nghị / Phản ánh",
    docType: "Đơn kiến nghị / Phản ánh",
    title: "Đơn kiến nghị về việc giải quyết thủ tục hành chính và hỗ trợ công dân",
    note: `Kính gửi: Lãnh đạo Cơ quan và Bộ phận Tiếp nhận & Trả kết quả

Tôi tên là: [Họ và tên người gửi]
Địa chỉ liên hệ: [Địa chỉ]

Kính trình bày sự việc như sau:
1. Nội dung sự việc / Thủ tục cần giải quyết:
- Trình bày tóm tắt nội dung yêu cầu...

2. Căn cứ và tài liệu chứng minh kèm theo:
- Đã đính kèm bản sao các giấy tờ liên quan trong hồ sơ này.

3. Yêu cầu giải quyết cụ thể:
- Kính đề nghị Quý cơ quan xem xét, kiểm tra và hướng dẫn/giải quyết theo đúng quy định.
Tôi xin cam đoan các nội dung trên là hoàn toàn trung thực và chịu trách nhiệm trước pháp luật.`,
  },
  {
    label: "📄 Mẫu Công văn đề xuất",
    docType: "Công văn đề xuất",
    title: "Công văn về việc đề nghị phối hợp công tác và trao đổi nghiệp vụ",
    note: `Kính gửi: Thủ trưởng Cơ quan và các Phòng ban chuyên môn

Thực hiện nhiệm vụ công tác và nhằm tăng cường sự phối hợp giữa các bên, xin trân trọng trao đổi nội dung sau:

1. Tình hình triển khai thực tế:
- Tóm tắt kết quả phối hợp trong thời gian qua...

2. Các nội dung đề xuất phối hợp tiếp theo:
- Nội dung 1: Trao đổi thông tin, tài liệu liên quan.
- Nội dung 2: Thống nhất kế hoạch và thời gian thực hiện.

Kính đề nghị cơ quan quan tâm, tạo điều kiện phối hợp giải quyết.`,
  },
];
export default function CitizenSubmitPage() {
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    onlineCode: string;
  } | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [canSubmit, setCanSubmit] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<Array<{ id: string; name: string; code: string }>>([]);

  function applyTemplate(tpl: typeof ADMINISTRATIVE_TEMPLATES[number]) {
    setForm((prev) => ({
      ...prev,
      docType: tpl.docType,
      title: tpl.title,
      note: tpl.note,
    }));
    setShowPreview(true);
    toast.success(`Đã nạp mẫu: ${tpl.label}`);
  }
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
          {/* Mẫu văn bản chuẩn Nghị định 30 */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 uppercase tracking-wide">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Mẫu Tờ trình & Thể thức văn bản chuẩn (Nghị định 30/2020/NĐ-CP)
              </span>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold flex items-center gap-1 cursor-pointer"
              >
                {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPreview ? "Thu gọn bản xem trước" : "Xem trước thể thức văn bản"}
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Chọn mẫu để tự động điền đầy đủ các ý: Căn cứ, Nội dung đề xuất và Kiến nghị theo chuẩn văn bản hành chính:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {ADMINISTRATIVE_TEMPLATES.map((tpl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className="px-3 py-1.5 text-xs font-medium bg-white text-indigo-800 border border-indigo-200 rounded hover:bg-indigo-100 hover:border-indigo-400 transition-colors shadow-2xs cursor-pointer"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bản xem trước thể thức văn bản hành chính theo NĐ 30 */}
          {showPreview && (
            <div className="bg-slate-50 border border-indigo-300 rounded-lg p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-2 border-slate-200">
                <span className="text-xs font-bold text-indigo-900 uppercase flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  Bản xem trước Thể thức Văn bản Hành chính (Nghị định 30/2020/NĐ-CP)
                </span>
                <span className="text-[11px] text-slate-500 italic">Khổ giấy mô phỏng A4</span>
              </div>

              <div className="bg-white border border-slate-200 rounded p-6 shadow-xs font-serif text-slate-900 text-xs md:text-sm space-y-4">
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                  <div className="text-center font-sans">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      {form.senderName || "NGƯỜI GỬI / ĐƠN VỊ ĐỀ NGHỊ"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {form.senderAddress || "Địa chỉ liên hệ"}
                    </p>
                    <div className="w-20 border-b border-slate-400 mx-auto my-1" />
                    <p className="text-[11px] text-slate-600">
                      SĐT: {form.senderPhone || "Chưa nhập"}
                    </p>
                  </div>

                  <div className="text-center font-sans">
                    <p className="text-xs md:text-sm font-bold uppercase tracking-tight text-slate-900">
                      CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </p>
                    <p className="text-xs md:text-sm font-bold text-slate-800 underline decoration-1 underline-offset-4 mt-0.5">
                      Độc lập - Tự do - Hạnh phúc
                    </p>
                    <div className="w-28 border-b-2 border-slate-800 mx-auto my-1.5" />
                    <p className="text-xs italic text-slate-600 font-serif">
                      Hà Nội, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                    </p>
                  </div>
                </div>

                <div className="text-center py-2">
                  <h3 className="text-base font-bold uppercase tracking-wide text-slate-900 font-sans">
                    {form.docType.toUpperCase()}
                  </h3>
                  <p className="mt-1 italic text-slate-700 font-medium">
                    V/v: {form.title || "[Trích yếu nội dung văn bản]"}
                  </p>
                </div>

                <div className="font-sans text-xs space-y-1">
                  <p className="font-semibold text-slate-900">
                    Kính gửi:{" "}
                    <span className="font-normal text-slate-700">
                      Ban Giám đốc cơ quan và Bộ phận tiếp nhận & giải quyết thủ tục
                    </span>
                  </p>
                </div>

                <div className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-relaxed bg-slate-50/60 p-3.5 rounded border border-slate-200">
                  {form.note || "Nội dung chi tiết các mục I (Căn cứ), II (Nội dung yêu cầu), III (Kiến nghị)..."}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 font-sans text-xs">
                  <div>
                    <p className="font-bold text-slate-900">Nơi nhận:</p>
                    <p className="text-slate-600">- Như Kính gửi;</p>
                    <p className="text-slate-600">- Lưu hồ sơ.</p>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-bold uppercase tracking-wider text-slate-900">NGƯỜI LẬP / ĐỀ NGHỊ</p>
                    <p className="text-slate-500 italic text-[11px]">(Ký và ghi rõ họ tên)</p>
                    <div className="h-10" />
                    <p className="font-bold text-slate-900">{form.senderName || "Họ và tên"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
