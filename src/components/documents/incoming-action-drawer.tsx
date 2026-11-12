"use client";

import { useEffect, useState, useMemo } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import type { AllowedAction } from "@/modules/document/state-machine/types";
import { toast } from "sonner";
import { Sparkles, Calendar, Building2, UserCheck, BookOpen } from "lucide-react";

type Position = {
  unit: { id: string; name: string; code?: string; level?: number };
  position?: { id: string; name: string };
  roles: { role: { code: string; name?: string } }[];
};

type Person = {
  id: string;
  fullName: string;
  employeeCode: string;
  positions: Position[];
};

type UnitItem = {
  id: string;
  name: string;
  code?: string;
  level?: number;
  parentId?: string | null;
};

const inputStyle =
  "w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors";

const QUICK_INSTRUCTIONS = [
  "Giao Đ/c Trưởng phòng chủ trì, chỉ đạo chuyên viên xử lý đúng quy định và báo cáo kết quả trước hạn.",
  "Khẩn trương thẩm định hồ sơ, dự thảo văn bản trả lời trình Lãnh đạo cơ quan ký ban hành.",
  "Chuyển phòng ban chuyên môn phối hợp các đơn vị liên quan xác minh thực tế và đề xuất phương án giải quyết.",
];

export function IncomingActionDrawer({
  action,
  documentId,
  onClose,
  onSaved,
}: {
  action: AllowedAction;
  documentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const needsOptions = [
    "RECEIVE_CITIZEN",
    "SUBMIT_LEADER",
    "LEADER_ANNOTATE",
    "CLERK_DISTRIBUTE",
  ].includes(action.action);

  const [people, setPeople] = useState<Person[]>([]);
  const [books, setBooks] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [rawUnits, setRawUnits] = useState<UnitItem[]>([]);
  const [loading, setLoading] = useState(needsOptions);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [headId, setHeadId] = useState("");
  const [bookId, setBookId] = useState("");
  const [deadline, setDeadline] = useState("");

  // Default deadline to 7 days ahead for annotations and clerk distributions
  useEffect(() => {
    if (
      ["LEADER_ANNOTATE", "CLERK_DISTRIBUTE"].includes(action.action) &&
      !deadline
    ) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setDeadline(d.toISOString().slice(0, 10));
    }
  }, [action.action, deadline]);

  useEffect(() => {
    if (!needsOptions) return;
    const controller = new AbortController();
    fetch("/api/documents/routing-options", { signal: controller.signal })
      .then((r) => r.json())
      .then((j) => {
        if (!j.success)
          throw new Error(
            j.error?.message || "Không tải được danh sách người nhận.",
          );
        const pList: Person[] = j.data.people || [];
        const bList = j.data.books || [];
        const uList: UnitItem[] = j.data.units || [];

        setPeople(pList);
        setBooks(bList);
        setRawUnits(uList);

        // Pre-select book if empty
        if (action.action === "RECEIVE_CITIZEN" && bList.length > 0) {
          setBookId(bList[0].id);
        }

        // Pre-select leader if empty
        if (action.action === "SUBMIT_LEADER") {
          const leaders = pList.filter((p) =>
            p.positions.some((pos) =>
              pos.roles.some((r) => ["LEADER", "ADMIN"].includes(r.role.code)),
            ),
          );
          if (leaders.length > 0) {
            setLeaderId(leaders[0].id);
          }
        }

        // Pre-select unit and department head for LEADER_ANNOTATE or CLERK_DISTRIBUTE
        if (
          action.action === "LEADER_ANNOTATE" ||
          action.action === "CLERK_DISTRIBUTE"
        ) {
          const functionalUnits = uList.filter(
            (u) => (u.level ?? 1) > 0 || uList.length === 1,
          );
          const initialUnit = functionalUnits[0] || uList[0];
          if (initialUnit) {
            setUnitId(initialUnit.id);

            // Find head in this unit
            const matchingHeads = pList.filter((p) =>
              p.positions.some(
                (pos) =>
                  pos.unit.id === initialUnit.id &&
                  pos.roles.some((r) =>
                    ["LEADER", "DEPT_HEAD"].includes(r.role.code),
                  ),
              ),
            );
            if (matchingHeads.length > 0) {
              setHeadId(matchingHeads[0].id);
            } else {
              // Fallback to any leader or staff
              const fallback = pList.filter((p) =>
                p.positions.some((pos) =>
                  pos.roles.some((r) =>
                    ["LEADER", "DEPT_HEAD"].includes(r.role.code),
                  ),
                ),
              );
              if (fallback.length > 0) setHeadId(fallback[0].id);
            }
          }
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [needsOptions, action.action]);

  // Selectable units: functional departments first, then others
  const units = useMemo(() => {
    if (rawUnits.length > 0) {
      // Functional units first
      const functional = rawUnits.filter((u) => (u.level ?? 1) > 0);
      const root = rawUnits.filter((u) => (u.level ?? 0) === 0);
      return [...functional, ...root];
    }
    // Fallback if units catalog not returned
    const map = new Map<string, UnitItem>();
    for (const p of people) {
      for (const pos of p.positions) {
        if (!map.has(pos.unit.id)) {
          map.set(pos.unit.id, {
            id: pos.unit.id,
            name: pos.unit.name,
            code: pos.unit.code,
            level: pos.unit.level,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [rawUnits, people]);

  // Candidates for selected department head
  const selectableHeads = useMemo(() => {
    if (!unitId) return [];
    // Priority 1: Leaders/Heads assigned to this unit
    const exactMatches = people.filter((p) =>
      p.positions.some(
        (pos) =>
          pos.unit.id === unitId &&
          pos.roles.some((r) => ["LEADER", "DEPT_HEAD"].includes(r.role.code)),
      ),
    );
    if (exactMatches.length > 0) return exactMatches;

    // Priority 2: Any staff assigned to this unit
    const unitStaff = people.filter((p) =>
      p.positions.some((pos) => pos.unit.id === unitId),
    );
    if (unitStaff.length > 0) return unitStaff;

    // Priority 3: System-wide Leaders (overseeing)
    return people.filter((p) =>
      p.positions.some((pos) =>
        pos.roles.some((r) => ["LEADER", "DEPT_HEAD"].includes(r.role.code)),
      ),
    );
  }, [people, unitId]);

  function handleUnitChange(nextUnitId: string) {
    setUnitId(nextUnitId);
    if (!nextUnitId) {
      setHeadId("");
      return;
    }
    const matching = people.filter((p) =>
      p.positions.some(
        (pos) =>
          pos.unit.id === nextUnitId &&
          pos.roles.some((r) => ["LEADER", "DEPT_HEAD"].includes(r.role.code)),
      ),
    );
    if (matching.length > 0) {
      setHeadId(matching[0].id);
    } else {
      const fallback = people.filter((p) =>
        p.positions.some((pos) =>
          pos.roles.some((r) => ["LEADER", "DEPT_HEAD"].includes(r.role.code)),
        ),
      );
      setHeadId(fallback[0]?.id || "");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/documents/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          action: action.action,
          reason,
          leaderId: leaderId || undefined,
          unitId: unitId || undefined,
          headId: headId || undefined,
          documentBookId: bookId || undefined,
          processingDeadline: deadline
            ? new Date(`${deadline}T23:59:59`).toISOString()
            : undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success)
        throw new Error(
          json.error?.message || "Không thực hiện được thao tác.",
        );
      toast.success(`Đã thực hiện: ${action.label}`);
      onClose();
      onSaved();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Không kết nối được máy chủ.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer isOpen onClose={onClose} title={action.label}>
      {loading ? (
        <div className="py-6 text-center text-sm text-slate-500 animate-pulse">
          Đang tải dữ liệu và phân quyền…
        </div>
      ) : error ? (
        <p role="alert" className="text-rose-600 text-sm py-4">
          {error}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {action.action === "RECEIVE_CITIZEN" && (
            <label className="block text-sm">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                <BookOpen className="h-4 w-4 text-indigo-600" />
                Sổ văn bản đến *
              </span>
              <select
                required
                className={inputStyle}
                value={bookId}
                onChange={(e) => setBookId(e.target.value)}
              >
                <option value="">Chọn sổ văn bản tiếp nhận</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {action.action === "SUBMIT_LEADER" && (
            <label className="block text-sm">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                <UserCheck className="h-4 w-4 text-indigo-600" />
                Lãnh đạo nhận trình *
              </span>
              <select
                required
                className={inputStyle}
                value={leaderId}
                onChange={(e) => setLeaderId(e.target.value)}
              >
                <option value="">Chọn lãnh đạo cơ quan</option>
                {people
                  .filter((p) =>
                    p.positions.some((pos) =>
                      pos.roles.some((r) =>
                        ["LEADER", "ADMIN"].includes(r.role.code),
                      ),
                    ),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.employeeCode})
                    </option>
                  ))}
              </select>
            </label>
          )}

          {["LEADER_ANNOTATE", "CLERK_DISTRIBUTE"].includes(action.action) && (
            <div className="space-y-3.5 bg-slate-50/70 p-3.5 rounded-lg border border-slate-200">
              <label className="block text-sm">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  Phòng ban xử lý chính *
                </span>
                <select
                  required
                  className={inputStyle}
                  value={unitId}
                  onChange={(e) => handleUnitChange(e.target.value)}
                >
                  <option value="">-- Chọn phòng ban xử lý --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.code ? `(${u.code})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  {action.action === "CLERK_DISTRIBUTE"
                    ? "Trưởng phòng phụ trách đơn vị *"
                    : "Trưởng phòng nhận chỉ đạo / Người phụ trách *"}
                </span>
                <select
                  required
                  className={inputStyle}
                  value={headId}
                  onChange={(e) => setHeadId(e.target.value)}
                >
                  <option value="">-- Chọn người nhận chỉ đạo --</option>
                  {selectableHeads.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.employeeCode})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  Hạn xử lý yêu cầu
                </span>
                <input
                  type="date"
                  className={inputStyle}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </label>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-800">
              {action.action === "LEADER_ANNOTATE"
                ? "Ý kiến chỉ đạo / Bút phê của Lãnh đạo *"
                : action.action === "CLERK_DISTRIBUTE"
                  ? "Ý kiến phân phối / Nội dung chuyển giao"
                  : "Ý kiến / Lý do giải quyết"}
              {action.requiresReason ? " *" : ""}
            </label>

            {["LEADER_ANNOTATE", "CLERK_DISTRIBUTE"].includes(action.action) && (
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Gợi ý nội dung nhanh:
                </span>
                <div className="flex flex-col gap-1.5">
                  {(action.action === "CLERK_DISTRIBUTE"
                    ? [
                        "Kính chuyển phòng ban chuyên môn chủ trì giải quyết đúng hạn.",
                        "Chuyển đơn vị phối hợp xác minh và tham mưu xử lý.",
                        "Đề nghị đơn vị nghiên cứu xử lý theo chức năng nhiệm vụ.",
                      ]
                    : QUICK_INSTRUCTIONS
                  ).map((hint, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReason(hint)}
                      className="text-left text-xs bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 text-slate-700 border border-slate-200 rounded px-2.5 py-1.5 transition-colors cursor-pointer"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              required={action.requiresReason || action.action === "LEADER_ANNOTATE"}
              maxLength={1000}
              rows={4}
              placeholder={
                action.action === "LEADER_ANNOTATE"
                  ? "Nhập ý kiến chỉ đạo, yêu cầu chuyên môn hoặc chọn gợi ý bên trên…"
                  : action.action === "CLERK_DISTRIBUTE"
                    ? "Nhập ý kiến phân phối hoặc chọn gợi ý bên trên…"
                    : "Nhập nội dung ý kiến hoặc lý do thực hiện thao tác…"
              }
              className={inputStyle}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button type="submit" isLoading={saving}>
              Xác nhận
            </Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}
