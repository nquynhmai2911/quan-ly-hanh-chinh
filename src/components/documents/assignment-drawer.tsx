"use client";
import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/lib/display-labels";
import { toast } from "sonner";

type Person = {
  id: string;
  employeeCode: string;
  fullName: string;
  positions: {
    unit: { id: string; name: string };
    roles: { role: { code: string; name: string } }[];
  }[];
};
type Selection = { person: Person; role: string; unitId: string };
const inputStyle = "w-full border border-slate-300 rounded px-3 py-2 text-sm";
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export function AssignmentDrawer({
  open,
  onClose,
  documentId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  documentId: string;
  onSaved: () => void;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [unit, setUnit] = useState("");
  const [sort, setSort] = useState("name-asc");
  const [selected, setSelected] = useState<Record<string, Selection>>({});
  const [deadline, setDeadline] = useState("");
  const [instruction, setInstruction] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/documents/assignees?documentId=${documentId}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j.success)
          throw new Error(
            j.error?.message || "Không tải được danh sách cán bộ.",
          );
        setPeople(j.data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, documentId]);
  const units = [
    ...new Map(
      people.flatMap((p) =>
        p.positions.map((pos) => [pos.unit.id, pos.unit] as const),
      ),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const roles = [
    ...new Set(
      people.flatMap((p) =>
        p.positions.flatMap((pos) => pos.roles.map((r) => r.role.code)),
      ),
    ),
  ];
  const filtered = people
    .filter(
      (p) =>
        (!search ||
          normalize(
            [
              p.id,
              p.employeeCode,
              p.fullName,
              ...p.positions.map((pos) => pos.unit.name),
            ].join(" "),
          ).includes(normalize(search))) &&
        p.positions.some(
          (pos) =>
            (!unit || pos.unit.id === unit) &&
            (!role || pos.roles.some((r) => r.role.code === role)),
        ),
    )
    .sort((a, b) => {
      const value = (p: Person) =>
        sort.startsWith("unit")
          ? p.positions
              .map((pos) => pos.unit.name)
              .sort((a, b) => a.localeCompare(b, "vi"))[0] || ""
          : sort.startsWith("code")
            ? p.employeeCode
            : p.fullName;
      return (
        (value(a).localeCompare(value(b), "vi", { numeric: true }) ||
          a.fullName.localeCompare(b.fullName, "vi")) *
        (sort.endsWith("desc") ? -1 : 1)
      );
    });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const chosen = Object.values(selected);
    if (chosen.filter((p) => p.role === "MAIN").length !== 1) {
      toast.error("Vui lòng chọn đúng một người chủ trì.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        `/api/documents/incoming/${documentId}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            handlers: chosen.map((p) => ({
              assigneeId: p.person.id,
              unitId: p.unitId,
              role: p.role,
              deadline: deadline || undefined,
              instruction,
            })),
          }),
        },
      );
      const json = await response.json();
      if (!response.ok || !json.success)
        throw new Error(json.error?.message || "Phân công thất bại.");
      toast.success("Đã phân công xử lý văn bản.");
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
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Phân công xử lý văn bản"
      description="Chọn một người chủ trì và các cán bộ phối hợp hoặc nhận để biết."
      width="xl"
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">
          Tìm cán bộ theo mã, họ tên hoặc phòng ban
          <input
            className={inputStyle}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nhập mã nhân viên, mã định danh, họ tên hoặc phòng ban"
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-sm">
            Vai trò
            <select
              className={inputStyle}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">Tất cả vai trò</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r] || "Cán bộ"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Phòng ban
            <select
              className={inputStyle}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            >
              <option value="">Tất cả phòng ban</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Sắp xếp
            <select
              className={inputStyle}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {[
                ["name-asc", "Họ tên: A → Z"],
                ["name-desc", "Họ tên: Z → A"],
                ["code-asc", "Mã nhân viên: tăng dần"],
                ["code-desc", "Mã nhân viên: giảm dần"],
                ["unit-asc", "Phòng ban: A → Z"],
                ["unit-desc", "Phòng ban: Z → A"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-sm">
          {filtered.length} cán bộ · Đã chọn {Object.keys(selected).length}
        </p>
        {loading ? (
          <p>Đang tải danh sách cán bộ…</p>
        ) : error ? (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        ) : (
          <div className="max-h-72 overflow-auto divide-y border rounded">
            {!filtered.length && (
              <p className="p-4">Không có cán bộ phù hợp.</p>
            )}
            {filtered.map((p) => (
              <label
                key={p.id}
                className="flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={!!selected[p.id]}
                  onChange={(e) =>
                    setSelected((previous) => {
                      const next = { ...previous };
                      if (e.target.checked)
                        next[p.id] = {
                          person: p,
                          role: Object.values(previous).some(
                            (p) => p.role === "MAIN",
                          )
                            ? "COORDINATE"
                            : "MAIN",
                          unitId: unit || p.positions[0].unit.id,
                        };
                      else delete next[p.id];
                      return next;
                    })
                  }
                />
                <span className="text-sm">
                  <strong>
                    {p.fullName} ({p.employeeCode})
                  </strong>
                  <span className="block text-slate-500">
                    {p.positions
                      .map(
                        (pos) =>
                          `${pos.unit.name} · ${pos.roles.map((r) => roleLabels[r.role.code] || r.role.name).join(", ")}`,
                      )
                      .join("; ")}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
        {Object.values(selected).map((p) => (
          <div
            key={p.person.id}
            className="grid grid-cols-3 gap-2 items-center text-sm"
          >
            <span>
              {p.person.fullName} ({p.person.employeeCode})
            </span>
            <select
              aria-label={`Vai trò xử lý của ${p.person.fullName}`}
              className={inputStyle}
              value={p.role}
              onChange={(e) =>
                setSelected((old) => ({
                  ...old,
                  [p.person.id]: { ...p, role: e.target.value },
                }))
              }
            >
              {["MAIN", "COORDINATE", "INFO"].map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
            </select>
            <select
              aria-label={`Phòng ban của ${p.person.fullName}`}
              className={inputStyle}
              value={p.unitId}
              onChange={(e) =>
                setSelected((old) => ({
                  ...old,
                  [p.person.id]: { ...p, unitId: e.target.value },
                }))
              }
            >
              {p.person.positions.map((pos) => (
                <option key={pos.unit.id} value={pos.unit.id}>
                  {pos.unit.name}
                </option>
              ))}
            </select>
          </div>
        ))}
        <label className="block text-sm">
          Hạn xử lý
          <input
            type="date"
            className={inputStyle}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Ý kiến giao việc
          <textarea
            className={inputStyle}
            maxLength={500}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            isLoading={saving}
            disabled={loading || !!error || !Object.keys(selected).length}
          >
            Xác nhận phân công
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
