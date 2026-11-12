import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
const tag = randomUUID().slice(0, 8);
const ids = [],
  uploads = [];
async function api(cookie, path, body) {
  const response = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      cookie: cookie || "",
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, json, response };
}
async function ok(cookie, path, body) {
  const r = await api(cookie, path, body);
  assert(
    r.status >= 200 && r.status < 300,
    `${path}: ${r.status} ${JSON.stringify(r.json)}`,
  );
  return r.json.data;
}
async function login(email, password = "Demo@123") {
  const r = await api("", "/api/auth/login", { email, password });
  assert.equal(r.status, 200);
  return r.response.headers.get("set-cookie").split(";")[0];
}
async function ensureStandardUsers() {
  const bcrypt = require("bcryptjs");
  const defaults = [
    { email: "vanthu@eoffice.local", code: "VT001", name: "Lê Văn Cường", role: "CLERK", pos: "Văn thư", unit: "VP" },
    { email: "giamdoc@eoffice.local", code: "GD001", name: "Nguyễn Văn An", role: "LEADER", pos: "Lãnh đạo", unit: "CQ" },
    { email: "truongphong.tchc@eoffice.local", code: "TP001", name: "Trần Thị Bình", role: "LEADER", pos: "Lãnh đạo", unit: "TCHC" },
    { email: "chuyenvien.tchc@eoffice.local", code: "CV001", name: "Phạm Thị Dung", role: "SPECIALIST", pos: "Chuyên viên", unit: "TCHC" },
    { email: "nguoidan@eoffice.local", code: "CD001", name: "Nguyễn Văn Dân", role: "CITIZEN", pos: "Chuyên viên", unit: "CQ" },
  ];
  for (const d of defaults) {
    const existing = await db.user.findFirst({ where: { OR: [{ email: d.email }, { employeeCode: d.code }] } });
    if (!existing) {
      const role = await db.role.findFirst({ where: { code: d.role } });
      const pos = await db.position.findFirst({ where: { name: d.pos } }) || await db.position.findFirst();
      const unit = await db.unit.findFirst({ where: { code: d.unit } }) || await db.unit.findFirst();
      await db.user.create({
        data: {
          employeeCode: d.code,
          email: d.email,
          fullName: d.name,
          passwordHash: await bcrypt.hash("Demo@123", 10),
          isActive: true,
          positions: {
            create: {
              unitId: unit.id,
              positionId: pos.id,
              isPrimary: true,
              roles: { create: { roleId: role.id, dataScope: "ALL" } },
            },
          },
        },
      });
    } else if (!existing.isActive) {
      await db.user.update({ where: { id: existing.id }, data: { isActive: true } });
    }
  }
}

try {
  await ensureStandardUsers();
  const admin = await login("admin@eoffice.local", "Admin@123"),
    citizen = await login("nguoidan@eoffice.local"),
    clerk = await login("vanthu@eoffice.local"),
    head = await login("truongphong.tchc@eoffice.local"),
    leader = await login("giamdoc@eoffice.local"),
    specialist = await login("chuyenvien.tchc@eoffice.local");
  for (const route of [
    "/api/admin/users",
    "/api/admin/units",
    "/api/admin/roles",
    "/api/admin/positions",
    "/api/admin/audit-logs",
  ])
    assert.equal((await api(citizen, route)).status, 403, route);
  for (const route of [
    "/api/admin/users",
    "/api/admin/units",
    "/api/admin/roles",
    "/api/admin/positions",
    "/api/admin/audit-logs?search=" + tag,
  ])
    await ok(admin, route);
  const empty = await ok(admin, "/api/reports?year=1901");
  assert.equal(empty.summary.totalIncoming, 0);
  assert.equal(empty.summary.totalOutgoing, 0);
  assert.equal(empty.sampleIncoming.length, 0);
  assert.equal(empty.deptStats.length, 0);
  const exported = await api(admin, "/api/reports/export-excel?year=1901");
  assert.equal(exported.status, 200);
  assert.equal(exported.json.trim().split("\r\n").length, 1);
  await ok(specialist, "/api/archives");
  await ok(head, "/api/tasks");
  await ok(leader, "/api/tasks");
  await ok(clerk, "/api/admin/books");
  console.log(
    "PASS: administrative permissions, real audit search, empty reports/export stay empty, scoped archives and worklists",
  );
  const user = await db.user.findUniqueOrThrow({
    where: { email: "chuyenvien.tchc@eoffice.local" },
    include: { positions: true },
  });
  const unitId = user.positions[0].unitId;
  const book = await db.documentBook.findFirstOrThrow({
    where: { bookType: "OUTGOING", isActive: true },
  });
  const bytes = Buffer.from("%PDF-1.4\nactual outgoing test " + tag);
  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: "application/pdf" }),
    tag + "-du-thao.pdf",
  );
  const file = await ok(specialist, "/api/upload", form);
  uploads.push(file);
  const doc = await ok(specialist, "/api/documents/outgoing", {
    title: "Kiểm thử văn bản đi " + tag,
    documentTypeId: "CV",
    draftUnitId: unitId,
    documentBookId: book.id,
    uploadIds: [file.uploadId],
  });
  ids.push(doc.id);
  const detail = await ok(specialist, "/api/documents/outgoing/" + doc.id);
  assert.equal(detail.document.files.length, 1);
  assert.equal(detail.document.approvals.length, 2);
  const downloaded = await fetch(
    base + "/api/files/" + detail.document.files[0].id,
    { headers: { cookie: specialist } },
  );
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
  const move = (cookie, action, reason) =>
    ok(cookie, "/api/documents/transition", {
      documentId: doc.id,
      action,
      reason,
    });
  assert.equal(
    (await api(citizen, "/api/documents/outgoing/" + doc.id)).status,
    403,
  );
  await move(specialist, "SUBMIT_FOR_REVIEW");
  await move(head, "REVIEW_REJECT", "Bổ sung căn cứ");
  await move(specialist, "RESUBMIT");
  await move(head, "REVIEW_APPROVE");
  const fail = await api(
    specialist,
    "/api/documents/outgoing/" + doc.id + "/sign",
    {},
  );
  assert.equal(fail.status, 403);
  assert.equal(
    await db.documentSignature.count({ where: { documentId: doc.id } }),
    0,
  );
  await fs.writeFile("uploads/" + file.fileKey, "changed bytes");
  assert.equal(
    (await api(leader, "/api/documents/outgoing/" + doc.id + "/sign", {}))
      .status,
    409,
  );
  assert.equal(
    await db.documentSignature.count({ where: { documentId: doc.id } }),
    0,
  );
  assert.equal(
    (
      await db.documentApproval.findFirstOrThrow({
        where: { documentId: doc.id, role: "APPROVER" },
      })
    ).status,
    "PENDING",
  );
  await fs.writeFile("uploads/" + file.fileKey, bytes);
  await ok(leader, "/api/documents/outgoing/" + doc.id + "/sign", {});
  assert.equal(
    await db.documentSignature.count({ where: { documentId: doc.id } }),
    1,
  );
  const approval = await db.documentApproval.findFirstOrThrow({
    where: { documentId: doc.id, role: "APPROVER" },
  });
  assert.equal(approval.status, "APPROVED");
  await move(clerk, "REGISTER_NUMBER");
  await move(clerk, "ISSUE");
  const issued = await db.document.findUniqueOrThrow({ where: { id: doc.id } });
  assert.equal(issued.status, "ISSUED");
  assert.equal(issued.isLocked, true);
  assert(issued.documentNumber);
  const lockedUpload = await api(
    specialist,
    `/api/documents/outgoing/${doc.id}/files`,
    form,
  );
  assert.equal(lockedUpload.status, 409);
  const report = await ok(
    specialist,
    `/api/reports?year=${new Date().getFullYear()}`,
  );
  assert(report.sampleOutgoing.some((d) => d.id === doc.id));
  const citizenReport = await ok(
    citizen,
    `/api/reports?year=${new Date().getFullYear()}`,
  );
  assert(!citizenReport.sampleOutgoing.some((d) => d.id === doc.id));
  console.log(
    "PASS: original outgoing upload, persisted reviewer chain, reject/resubmit, permission check, atomic electronic approval, numbering and issue lock",
  );
} finally {
  await db.notification.deleteMany({ where: { documentId: { in: ids } } });
  await db.auditLog.deleteMany({ where: { recordId: { in: ids } } });
  await db.document.deleteMany({ where: { id: { in: ids } } });
  await db.pendingUpload.deleteMany({
    where: { id: { in: uploads.map((f) => f.uploadId) } },
  });
  for (const f of uploads)
    await fs.unlink("uploads/" + f.fileKey).catch(() => {});
  await db.$disconnect();
}
