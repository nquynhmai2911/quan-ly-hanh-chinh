// Requires the local development server and seeded local accounts.
// Creates isolated test records and removes them in finally.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const db = new PrismaClient();
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";
const tag = randomUUID().slice(0, 8);
const docs = [],
  uploads = [],
  users = [];
async function request(cookie, path, body, method) {
  const response = await fetch(base + path, {
    method: method || (body ? "POST" : "GET"),
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
  const r = await request(cookie, path, body);
  assert(
    r.status >= 200 && r.status < 300,
    `${path}: ${r.status} ${JSON.stringify(r.json)}`,
  );
  return r.json.data;
}
async function denied(cookie, path, body) {
  const r = await request(cookie, path, body);
  assert(
    [400, 403, 404, 409].includes(r.status),
    `${path} should reject, got ${r.status}`,
  );
}
async function login(email, password = "Demo@123") {
  const r = await request("", "/api/auth/login", { email, password });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.response.headers.get("set-cookie").split(";")[0];
}
async function temporaryUser(role, unitId) {
  const roleRecord = await db.role.findUniqueOrThrow({ where: { code: role } });
  const position = await db.position.findFirstOrThrow();
  const user = await db.user.create({
    data: {
      employeeCode: `T-${role}-${tag}-${users.length}`,
      email: `test-${tag}-${users.length}@eoffice.local`,
      fullName: `Kiểm thử ${role} ${tag}`,
      passwordHash: await bcrypt.hash("Demo@123", 10),
      positions: {
        create: {
          unitId,
          positionId: position.id,
          isPrimary: true,
          roles: { create: { roleId: roleRecord.id, dataScope: "OWN" } },
        },
      },
    },
  });
  users.push(user.id);
  return { ...user, cookie: await login(user.email) };
}
async function upload(cookie, name, bytes, type = "image/png") {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), `${tag}-${name}`);
  const data = await ok(cookie, "/api/upload", form);
  uploads.push(data);
  return data;
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9mQAAAAASUVORK5CYII=",
  "base64",
);
async function ensureStandardUsers() {
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
  const citizen = await login("nguoidan@eoffice.local");
  const clerk = await login("vanthu@eoffice.local");
  const leader = await login("giamdoc@eoffice.local");
  const head = await login("truongphong.tchc@eoffice.local");
  const specialist = await login("chuyenvien.tchc@eoffice.local");
  const admin = await login("admin@eoffice.local", "Admin@123");
  assert.equal(
    (
      await request("", "/api/auth/login", {
        email: "admin@eoffice.local",
        password: "wrongpassword",
      })
    ).status,
    401,
  );
  const staff = await db.user.findMany({
    where: {
      email: {
        in: [
          "giamdoc@eoffice.local",
          "truongphong.tchc@eoffice.local",
          "chuyenvien.tchc@eoffice.local",
        ],
      },
    },
    include: { positions: true },
  });
  const leaderUser = staff.find((u) => u.email.startsWith("giamdoc"));
  const headUser = staff.find((u) => u.email.startsWith("truongphong"));
  const specialistUser = staff.find((u) => u.email.startsWith("chuyenvien"));
  const unitId = headUser.positions[0].unitId;
  const stranger = await temporaryUser("CITIZEN", unitId);
  const otherLeader = await temporaryUser("LEADER", unitId);
  const otherHead = await temporaryUser("DEPT_HEAD", unitId);
  const coworker = await temporaryUser("SPECIALIST", unitId);
  const observer = await temporaryUser("SPECIALIST", unitId);
  const outsiderUnit = await db.unit.findFirstOrThrow({
    where: { id: { not: unitId } },
  });
  const outsider = await temporaryUser("SPECIALIST", outsiderUnit.id);
  const first = await upload(citizen, "ban-goc.png", png);
  const second = await upload(
    citizen,
    "phu-luc.pdf",
    Buffer.from("%PDF-1.4\noriginal attachment " + tag),
    "application/pdf",
  );
  const payload = {
    senderName: "Người kiểm thử",
    senderPhone: "0912345678",
    senderEmail: "kiemthu@example.com",
    senderAddress: "Địa chỉ kiểm thử",
    docType: "Đơn kiến nghị / Phản ánh",
    title: `Hồ sơ kiểm thử ${tag}`,
    attachments: [{ uploadId: first.uploadId }, { uploadId: second.uploadId }],
  };
  await denied(stranger.cookie, "/api/citizen/submit-document", payload);
  await denied(citizen, "/api/citizen/submit-document", {
    ...payload,
    attachments: [],
  });
  await denied(citizen, "/api/citizen/submit-document", {
    ...payload,
    attachments: [{ uploadId: first.uploadId }, { uploadId: "missing-upload" }],
  });
  assert.equal(
    (
      await db.pendingUpload.findUniqueOrThrow({
        where: { id: first.uploadId },
      })
    ).claimedAt,
    null,
  );
  const created = await ok(citizen, "/api/citizen/submit-document", payload);
  docs.push(created.id);
  const id = created.id,
    detailPath = `/api/documents/incoming/${id}`;
  let detail = await ok(citizen, detailPath);
  assert.equal(detail.document.status, "SUBMITTED");
  assert.equal(detail.document.files.length, 2);
  assert.equal(detail.allowedActions.length, 0);
  assert.equal(
    (
      await db.document.findUniqueOrThrow({
        where: { id },
        include: { workflow: true },
      })
    ).workflow.trackingCode,
    created.onlineCode,
  );
  assert(
    (await ok(citizen, "/api/citizen/submit-document")).some(
      (d) => d.id === id,
    ),
  );
  await denied(citizen, "/api/citizen/submit-document", payload); // consumed upload cannot be reused
  const fileId = detail.document.files.find((f) =>
    f.fileName.endsWith("ban-goc.png"),
  ).id;
  const downloaded = await fetch(base + "/api/files/" + fileId, {
    headers: { cookie: citizen },
  });
  assert.equal(downloaded.status, 200);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png);
  for (const actor of [
    stranger.cookie,
    otherLeader.cookie,
    otherHead.cookie,
    outsider.cookie,
  ]) {
    await denied(actor, detailPath);
    await denied(actor, "/api/files/" + fileId);
    assert(
      !(await ok(actor, `/api/documents/incoming?search=${tag}`)).some(
        (d) => d.id === id,
      ),
    );
    assert(!(await ok(actor, `/api/search?q=${tag}`)).some((d) => d.id === id));
  }
  console.log(
    "PASS: authentication, persisted multi-file citizen submission, original bytes, ownership and search isolation",
  );
  const transition = (cookie, action, extra = {}) =>
    ok(cookie, "/api/documents/transition", {
      documentId: id,
      action,
      ...extra,
    });
  const rejectTransition = (cookie, action, extra = {}) =>
    denied(cookie, "/api/documents/transition", {
      documentId: id,
      action,
      ...extra,
    });
  await rejectTransition(citizen, "RECEIVE_CITIZEN");
  const options = await ok(clerk, "/api/documents/routing-options");
  const bookId = options.books[0].id;
  await transition(clerk, "RECEIVE_CITIZEN", { documentBookId: bookId });
  await rejectTransition(clerk, "RECEIVE_CITIZEN", { documentBookId: bookId });
  await denied(head, detailPath + "/assign", {
    handlers: [{ assigneeId: specialistUser.id, unitId, role: "MAIN" }],
  });
  await rejectTransition(clerk, "SUBMIT_LEADER", {
    leaderId: specialistUser.id,
  });
  await transition(clerk, "SUBMIT_LEADER", { leaderId: leaderUser.id });
  await denied(clerk, detailPath + "/files", new FormData());
  await rejectTransition(otherLeader.cookie, "LEADER_ANNOTATE", {
    headId: headUser.id,
    unitId,
    reason: "Không được giao",
  });
  await rejectTransition(leader, "LEADER_ANNOTATE", {
    headId: headUser.id,
    unitId,
  });
  await transition(leader, "RETURN_CLERK", {
    reason: "Bổ sung hồ sơ trước khi phân phối",
  });
  await transition(clerk, "SUBMIT_LEADER", { leaderId: leaderUser.id });
  await transition(leader, "LEADER_ANNOTATE", {
    headId: headUser.id,
    unitId,
    reason: "Giao phòng thẩm tra và báo cáo kết quả",
    processingDeadline: new Date(Date.now() + 86400000).toISOString(),
  });
  await rejectTransition(otherHead.cookie, "DEPT_HEAD_RETURN", {
    reason: "Không được giao",
  });
  await transition(head, "DEPT_HEAD_RETURN", {
    reason: "Đề nghị làm rõ yêu cầu",
  });
  await transition(leader, "LEADER_ANNOTATE", {
    headId: headUser.id,
    unitId,
    reason: "Đã làm rõ, giao phòng xử lý",
  });
  const candidates = await ok(
    head,
    `/api/documents/assignees?documentId=${id}`,
  );
  assert(candidates.some((p) => p.id === specialistUser.id));
  assert(!candidates.some((p) => p.id === outsider.id));
  await denied(otherHead.cookie, `/api/documents/assignees?documentId=${id}`);
  await denied(head, detailPath + "/assign", {
    handlers: [
      { assigneeId: outsider.id, unitId: outsiderUnit.id, role: "MAIN" },
    ],
  });
  await denied(head, detailPath + "/assign", {
    handlers: [{ assigneeId: specialistUser.id, unitId, role: "COORDINATE" }],
  });
  const handlers = [
    { assigneeId: specialistUser.id, unitId, role: "MAIN" },
    { assigneeId: coworker.id, unitId, role: "COORDINATE" },
    { assigneeId: observer.id, unitId, role: "INFO" },
  ];
  const assigned = await Promise.all([
    request(head, detailPath + "/assign", { handlers }),
    request(head, detailPath + "/assign", { handlers }),
  ]);
  assert.equal(assigned.filter((r) => r.status === 201).length, 1);
  assert.equal(
    await db.documentHandler.count({ where: { documentId: id } }),
    3,
  );
  console.log(
    "PASS: exact leader/head ownership, no skipped stages, return loops, department selection, concurrent assignment protection",
  );
  await rejectTransition(head, "APPROVE_COMPLETE");
  await denied(observer.cookie, detailPath + "/report", {
    reportContent: "Người nhận để biết không được báo cáo",
  });
  await denied(outsider.cookie, detailPath + "/report", {
    reportContent: "Không được phân công",
  });
  await ok(specialist, detailPath + "/report", {
    reportContent: "Đã xử lý phần chủ trì",
  });
  await rejectTransition(specialist, "SUBMIT_REVIEW");
  await ok(coworker.cookie, detailPath + "/report", {
    reportContent: "Đã xử lý phần phối hợp",
  });
  await transition(specialist, "SUBMIT_REVIEW");
  await rejectTransition(specialist, "APPROVE_COMPLETE");
  await transition(head, "REJECT_REPORT", {
    reason: "Bổ sung căn cứ giải quyết",
  });
  await rejectTransition(head, "APPROVE_COMPLETE");
  await ok(specialist, detailPath + "/report", {
    reportContent: "Đã bổ sung căn cứ chủ trì",
  });
  const task = await db.documentHandler.findFirstOrThrow({
    where: { documentId: id, assigneeId: coworker.id },
  });
  assert.equal(
    (
      await request(
        outsider.cookie,
        "/api/tasks/" + task.id,
        { status: "REPORTED", reportContent: "Giả mạo báo cáo" },
        "PATCH",
      )
    ).status,
    404,
  );
  const taskResult = await request(
    coworker.cookie,
    "/api/tasks/" + task.id,
    { status: "REPORTED", reportContent: "Đã bổ sung căn cứ phối hợp" },
    "PATCH",
  );
  assert.equal(taskResult.status, 200, JSON.stringify(taskResult.json));
  await transition(specialist, "SUBMIT_REVIEW");
  await transition(head, "APPROVE_COMPLETE");
  detail = await ok(citizen, detailPath);
  assert.equal(detail.document.status, "COMPLETED");
  assert.equal(detail.document.isLocked, true);
  assert.equal(detail.document.files.length, 2);
  assert.equal(detail.allowedActions.length, 0);
  assert.equal(
    detail.auditLogs.filter((l) => l.action === "DOC_HANDLER_REPORT").length,
    4,
  );
  assert(
    detail.auditLogs.some(
      (l) =>
        l.action === "DOC_APPROVE_COMPLETE" && l.actor.employeeCode === "TP001",
    ),
  );
  await denied(specialist, detailPath + "/report", {
    reportContent: "Sửa báo cáo sau hoàn thành",
  });
  await denied(admin, detailPath + "/files", new FormData());
  const notifications = (await ok(citizen, "/api/notifications")).notifications;
  assert(notifications.some((n) => n.documentId === id));
  const foreignNotification = notifications.find((n) => n.documentId === id);
  assert.equal(
    (
      await request(
        stranger.cookie,
        "/api/notifications",
        { notificationId: foreignNotification.id },
        "PATCH",
      )
    ).status,
    404,
  );
  console.log(
    "PASS: own reports, all workers required, rework cycle, completion lock, complete audit trail and targeted notifications",
  );
} finally {
  const fileRecords = await db.documentFile.findMany({
    where: { documentId: { in: docs } },
    select: { fileKey: true },
  });
  await db.notification.deleteMany({
    where: {
      OR: [
        { documentId: { in: docs } },
        { recipientId: { in: users } },
        { actorId: { in: users } },
      ],
    },
  });
  await db.auditLog.deleteMany({
    where: { OR: [{ recordId: { in: docs } }, { actorId: { in: users } }] },
  });
  await db.document.deleteMany({ where: { id: { in: docs } } });
  await db.pendingUpload.deleteMany({
    where: { id: { in: uploads.map((u) => u.uploadId) } },
  });
  for (const id of users) {
    await db.userPosition.deleteMany({ where: { userId: id } });
    await db.user.delete({ where: { id } });
  }
  for (const key of new Set(
    fileRecords.map((f) => f.fileKey).concat(uploads.map((u) => u.fileKey)),
  ))
    await fs.unlink("uploads/" + key).catch(() => {});
  await db.$disconnect();
}
