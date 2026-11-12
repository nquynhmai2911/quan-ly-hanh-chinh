"use client";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import type { AllowedAction } from "@/modules/document/state-machine/types";
import { toast } from "sonner";
type Person = {
  id: string;
  fullName: string;
  employeeCode: string;
  positions: {
    unit: { id: string; name: string };
    roles: { role: { code: string } }[];
  }[];
};
const inputStyle = "w-full border border-slate-300 rounded px-3 py-2 text-sm";
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
  ].includes(action.action);
  const [people, setPeople] = useState<Person[]>([]);
  const [books, setBooks] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(needsOptions);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [headId, setHeadId] = useState("");
  const [bookId, setBookId] = useState("");
  const [deadline, setDeadline] = useState("");
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
        setPeople(j.data.people);
        setBooks(j.data.books);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [needsOptions]);
  const heads = people.filter((p) =>
    p.positions.some((pos) =>
      pos.roles.some((r) => r.role.code === "DEPT_HEAD"),
    ),
  );
  const units = [
    ...new Map(
      heads.flatMap((p) =>
        p.positions
          .filter((pos) => pos.roles.some((r) => r.role.code === "DEPT_HEAD"))
          .map((pos) => [pos.unit.id, pos.unit] as const),
      ),
    ).values(),
  ];
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
        <p>Đang tải danh sách…</p>
      ) : error ? (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {action.action === "RECEIVE_CITIZEN" && (
            <label className="block text-sm">
              Sổ văn bản đến
              <select
                required
                className={inputStyle}
                value={bookId}
                onChange={(e) => setBookId(e.target.value)}
              >
                <option value="">Chọn sổ văn bản</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {action.action === "SUBMIT_LEADER" && (
            <label className="block text-sm">
              Lãnh đạo nhận trình
              <select
                required
                className={inputStyle}
                value={leaderId}
                onChange={(e) => setLeaderId(e.target.value)}
              >
                <option value="">Chọn lãnh đạo</option>
                {people
                  .filter((p) =>
                    p.positions.some((pos) =>
                      pos.roles.some((r) => r.role.code === "LEADER"),
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
          {action.action === "LEADER_ANNOTATE" && (
            <>
              <label className="block text-sm">
                Phòng ban xử lý
                <select
                  required
                  className={inputStyle}
                  value={unitId}
                  onChange={(e) => {
                    setUnitId(e.target.value);
                    setHeadId("");
                  }}
                >
                  <option value="">Chọn phòng ban</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Trưởng phòng nhận xử lý
                <select
                  required
                  className={inputStyle}
                  value={headId}
                  onChange={(e) => setHeadId(e.target.value)}
                >
                  <option value="">Chọn trưởng phòng</option>
                  {heads
                    .filter((p) =>
                      p.positions.some(
                        (pos) =>
                          pos.unit.id === unitId &&
                          pos.roles.some((r) => r.role.code === "DEPT_HEAD"),
                      ),
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} ({p.employeeCode})
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm">
                Hạn xử lý
                <input
                  type="date"
                  className={inputStyle}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </label>
            </>
          )}
          <label className="block text-sm">
            {action.action === "LEADER_ANNOTATE"
              ? "Ý kiến chỉ đạo"
              : "Ý kiến / lý do"}
            {action.requiresReason ? " *" : ""}
            <textarea
              required={action.requiresReason}
              maxLength={1000}
              rows={4}
              className={inputStyle}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
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
