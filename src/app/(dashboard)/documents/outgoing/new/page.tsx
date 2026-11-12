// src/app/(dashboard)/documents/outgoing/new/page.tsx
// Form Tạo dự thảo Văn bản đi / Tờ trình nội bộ theo đúng quy trình 4 vai trò

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
import {
  Send,
  UploadCloud,
  ArrowLeft,
  Building2,
  Sparkles,
  Briefcase,
  Users,
  UserCheck,
  FileCheck2,
} from "lucide-react";

type SpecialistItem = {
  id: string;
  fullName: string;
  employeeCode: string;
  unitName?: string;
};

type CitizenItem = {
  id: string;
  fullName: string;
  email: string;
  employeeCode?: string;
};

export default function NewOutgoingDraftPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [units, setUnits] = useState<
    Array<{ id: string; name: string; code: string }>
  >([]);
  const [books, setBooks] = useState<Array<{ id: string; name: string }>>([]);
  const [specialists, setSpecialists] = useState<SpecialistItem[]>([]);
  const [citizens, setCitizens] = useState<CitizenItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Đối tượng nhận theo luồng văn bản đi (Lãnh đạo -> Chuyên viên / Người dân)
  const [recipientType, setRecipientType] = useState<
    "SPECIALIST" | "CITIZEN" | "OTHER"
  >("SPECIALIST");
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [relatedDocId, setRelatedDocId] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateOutgoingDraftFormData>({
    resolver: zodResolver(
      createOutgoingDraftSchema,
    ) as unknown as Resolver<CreateOutgoingDraftFormData>,
    defaultValues: {
      draftUnitId: "",
      documentTypeId: "CV",
      urgency: "NORMAL",
      security: "NORMAL",
      sendType: "Điện tử & Giấy",
      recipientType: "SPECIALIST",
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

    fetch("/api/documents/routing-options")
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const rawPeople: Array<{
            id: string;
            fullName: string;
            employeeCode: string;
            positions: Array<{
              unit: { name: string };
              roles: Array<{ role: { code: string } }>;
            }>;
          }> = j.data.people || [];

          const specList: SpecialistItem[] = rawPeople
            .filter((p) =>
              p.positions.some((pos) =>
                pos.roles.some((r) => r.role.code === "SPECIALIST"),
              ),
            )
            .map((p) => ({
              id: p.id,
              fullName: p.fullName,
              employeeCode: p.employeeCode,
              unitName: p.positions[0]?.unit.name,
            }));
          setSpecialists(specList);
          if (specList.length > 0) {
            setSelectedRecipientId(specList[0].id);
            setValue("recipientId", specList[0].id);
            setValue(
              "recipientsSummary",
              `Chuyên viên: ${specList[0].fullName} (${specList[0].employeeCode})`,
            );
          }

          const rawCitizens: CitizenItem[] = j.data.citizens || [];
          setCitizens(rawCitizens);
        }
      })
      .catch(() => {});
  }, [setValue]);

  function handleSwitchRecipientType(type: "SPECIALIST" | "CITIZEN" | "OTHER") {
    setRecipientType(type);
    setValue("recipientType", type);
    if (type === "SPECIALIST") {
      const first = specialists[0];
      if (first) {
        setSelectedRecipientId(first.id);
        setValue("recipientId", first.id);
        setValue(
          "recipientsSummary",
          `Chuyên viên: ${first.fullName} (${first.employeeCode})`,
        );
      }
    } else if (type === "CITIZEN") {
      const first = citizens[0];
      if (first) {
        setSelectedRecipientId(first.id);
        setValue("recipientId", first.id);
        setValue("recipientsSummary", `Người dân: ${first.fullName} (${first.email})`);
      } else {
        setSelectedRecipientId("");
        setValue("recipientId", null);
      }
    } else {
      setSelectedRecipientId("");
      setValue("recipientId", null);
      setValue("recipientsSummary", "Các cơ quan, ban ngành liên quan");
    }
  }

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
          recipientType,
          recipientId: selectedRecipientId || undefined,
          relatedDocumentId: relatedDocId || undefined,
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
            Soạn thảo Văn bản đi / Dự thảo chỉ đạo
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Lãnh đạo tạo hoặc phê duyệt văn bản đi gửi Chuyên viên (Nhiệm vụ nội bộ) hoặc Người dân (Phản hồi giải quyết)
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
                setValue(
                  "title",
                  "Tờ trình về việc đề xuất phê duyệt chủ trương và kế hoạch triển khai công tác",
                );
                setValue("signerPosition", "Trưởng phòng");
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
                setValue(
                  "title",
                  "V/v giải quyết kiến nghị, phản ánh và trả lời công dân",
                );
                setValue("signerPosition", "Giám đốc");
                toast.success("Đã nạp mẫu Công văn phản hồi (CV)");
              }}
              className="px-3 py-1.5 text-xs font-medium bg-white text-indigo-800 border border-indigo-200 rounded hover:bg-indigo-100 hover:border-indigo-400 transition-colors shadow-2xs cursor-pointer"
            >
              📄 Mẫu Công văn trả lời (CV)
            </button>
            <button
              type="button"
              onClick={() => {
                setValue("documentTypeId", "TB");
                setValue(
                  "title",
                  "Thông báo phân công nhiệm vụ và chỉ đạo thực hiện công tác chuyên môn",
                );
                setValue("signerPosition", "Giám đốc");
                toast.success("Đã nạp mẫu Thông báo chỉ đạo (TB)");
              }}
              className="px-3 py-1.5 text-xs font-medium bg-white text-indigo-800 border border-indigo-200 rounded hover:bg-indigo-100 hover:border-indigo-400 transition-colors shadow-2xs cursor-pointer"
            >
              📢 Mẫu Thông báo chỉ đạo (TB)
            </button>
          </div>
        </div>

        {/* 1. THÔNG TIN DỰ THẢO */}
        <div className="bg-white rounded border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Send className="h-4 w-4 text-indigo-600" />
            1. THÔNG TIN VĂN BẢN
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Trích yếu nội dung văn bản / dự thảo *
            </label>
            <textarea
              rows={3}
              required
              {...register("title")}
              placeholder="VD: V/v giải quyết đơn kiến nghị của công dân hoặc giao nhiệm vụ chuyên môn..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
            />
            {errors.title && (
              <p className="text-xs text-rose-500 mt-1">
                {errors.title.message}
              </p>
            )}
          </div>
        </div>

        {/* 2. CHỌN ĐỐI TƯỢNG NHẬN (Theo quy trình Luồng văn bản đi) */}
        <div className="bg-white rounded border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-indigo-600" />
              2. ĐỐI TƯỢNG NHẬN VĂN BẢN (Theo luồng xử lý)
            </span>
            <span className="text-xs font-normal text-slate-500">
              Chọn nhóm đối tượng để hệ thống phân phối tự động
            </span>
          </h2>

          {/* 3 Lựa chọn đối tượng */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Nhánh 1: Chuyên viên */}
            <div
              onClick={() => handleSwitchRecipientType("SPECIALIST")}
              className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                recipientType === "SPECIALIST"
                  ? "border-indigo-600 bg-indigo-50/60 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Briefcase
                  className={`h-4 w-4 ${
                    recipientType === "SPECIALIST"
                      ? "text-indigo-600"
                      : "text-slate-500"
                  }`}
                />
                <span className="font-bold text-xs text-slate-900">
                  Chuyên viên
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Nhận chỉ đạo, nhiệm vụ, văn bản nội bộ. Hồ sơ sẽ xuất hiện trong
                Bàn làm việc (Việc của tôi).
              </p>
            </div>

            {/* Nhánh 2: Người dân */}
            <div
              onClick={() => handleSwitchRecipientType("CITIZEN")}
              className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                recipientType === "CITIZEN"
                  ? "border-emerald-600 bg-emerald-50/60 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Users
                  className={`h-4 w-4 ${
                    recipientType === "CITIZEN"
                      ? "text-emerald-600"
                      : "text-slate-500"
                  }`}
                />
                <span className="font-bold text-xs text-slate-900">
                  Người dân
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Nhận văn bản phản hồi, thông báo, kết quả giải quyết thủ tục hành
                chính.
              </p>
            </div>

            {/* Nhánh 3: Cơ quan khác */}
            <div
              onClick={() => handleSwitchRecipientType("OTHER")}
              className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                recipientType === "OTHER"
                  ? "border-slate-700 bg-slate-100 shadow-xs"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Building2
                  className={`h-4 w-4 ${
                    recipientType === "OTHER"
                      ? "text-slate-800"
                      : "text-slate-500"
                  }`}
                />
                <span className="font-bold text-xs text-slate-900">
                  Cơ quan khác
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Nơi nhận bên ngoài, liên thông hoặc gửi bưu điện.
              </p>
            </div>
          </div>

          {/* Form chi tiết theo đối tượng đã chọn */}
          <div className="pt-2">
            {recipientType === "SPECIALIST" && (
              <div className="space-y-3 bg-indigo-50/30 p-3.5 rounded-lg border border-indigo-100">
                <label className="block text-xs font-semibold text-slate-700">
                  Chọn Chuyên viên nhận nhiệm vụ / chỉ đạo *
                </label>
                <select
                  value={selectedRecipientId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedRecipientId(id);
                    setValue("recipientId", id);
                    const s = specialists.find((item) => item.id === id);
                    if (s) {
                      setValue(
                        "recipientsSummary",
                        `Chuyên viên: ${s.fullName} (${s.employeeCode})`,
                      );
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
                >
                  {specialists.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.employeeCode}) - {s.unitName || "Chuyên viên"}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-indigo-700">
                  💡 Sau khi văn bản được lưu, Chuyên viên sẽ nhận được thông báo
                  nhiệm vụ và xem tại Bàn làm việc & Điều hành.
                </p>
              </div>
            )}

            {recipientType === "CITIZEN" && (
              <div className="space-y-3 bg-emerald-50/30 p-3.5 rounded-lg border border-emerald-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Chọn Người dân nhận kết quả / phản hồi *
                    </label>
                    <select
                      value={selectedRecipientId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setSelectedRecipientId(id);
                        setValue("recipientId", id);
                        const c = citizens.find((item) => item.id === id);
                        if (c) {
                          setValue(
                            "recipientsSummary",
                            `Người dân: ${c.fullName} (${c.email})`,
                          );
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-emerald-600 outline-none"
                    >
                      <option value="">-- Chọn công dân nhận phản hồi --</option>
                      {citizens.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} ({c.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mã hồ sơ văn bản đến liên quan (tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={relatedDocId}
                      onChange={(e) => setRelatedDocId(e.target.value)}
                      placeholder="VD: DTT-2026-..."
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-emerald-600 outline-none"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-emerald-700">
                  💡 Người dân sẽ nhận được thông báo phản hồi và theo dõi kết quả
                  giải quyết trên Cổng Dịch vụ công.
                </p>
              </div>
            )}

            {recipientType === "OTHER" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nơi nhận ngoài (Tóm tắt) *
                </label>
                <input
                  type="text"
                  {...register("recipientsSummary")}
                  placeholder="VD: Sở Tài chính, UBND Tỉnh, Bộ Nội vụ..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* 3. FILE DỰ THẢO */}
        <div className="bg-white rounded border border-slate-200 p-6 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-indigo-600" />
            3. FILE VĂN BẢN / DỰ THẢO (WORD / PDF)
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
            Lưu văn bản đi
          </Button>
        </div>
      </form>
    </div>
  );
}
