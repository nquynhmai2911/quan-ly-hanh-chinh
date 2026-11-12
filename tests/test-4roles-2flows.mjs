// tests/test-4roles-2flows.mjs
// Kiểm thử tự động toàn diện: 4 Vai trò & 2 Luồng xử lý văn bản theo đúng yêu cầu nghiệp vụ

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3001";

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

async function ok(cookie, path, body, method) {
  const r = await request(cookie, path, body, method);
  assert(
    r.status >= 200 && r.status < 300,
    `${path}: ${r.status} ${JSON.stringify(r.json)}`,
  );
  return r.json.data;
}

async function login(email, password = "Demo@123") {
  const r = await request("", "/api/auth/login", { email, password });
  assert.equal(r.status, 200, `Login failed for ${email}: ${JSON.stringify(r.json)}`);
  return r.response.headers.get("set-cookie").split(";")[0];
}

async function runTests() {
  console.log("=== BẮT ĐẦU KIỂM THỬ 4 VAI TRÒ & 2 LUỒNG XỬ LÝ ===");

  // 1. Đăng nhập 4 vai trò
  const citizen = await login("nguoidan@eoffice.local");
  const specialist = await login("chuyenvien.tchc@eoffice.local");
  const leader = await login("giamdoc@eoffice.local");
  const admin = await login("admin@eoffice.local", "Admin@123");

  const citizenUser = await db.user.findFirstOrThrow({ where: { email: "nguoidan@eoffice.local" } });
  const specialistUser = await db.user.findFirstOrThrow({ where: { email: "chuyenvien.tchc@eoffice.local" }, include: { positions: true } });
  const leaderUser = await db.user.findFirstOrThrow({ where: { email: "giamdoc@eoffice.local" } });

  console.log("  [+] Đăng nhập thành công 4 vai trò: Citizen, Specialist, Leader, Admin");

  // -------------------------------------------------------------
  // FLOW 1: LUỒNG VĂN BẢN ĐẾN
  // Người dân -> Chuyên viên tiếp nhận & xử lý -> Lãnh đạo phê duyệt -> Người dân nhận kết quả
  // -------------------------------------------------------------
  console.log("\n--- TEST FLOW 1: LUỒNG VĂN BẢN ĐẾN ---");

  // BƯỚC 1: Người dân gửi văn bản đến (Cổng DVC)
  const tag = Date.now();
  const incomingBook = await db.documentBook.findFirstOrThrow({ where: { bookType: "INCOMING", isActive: true } });
  const docType = await db.documentType.findFirstOrThrow({ where: { isActive: true } });

  // Upload file giả lập cho người dân
  const form = new FormData();
  form.append(
    "file",
    new Blob([Buffer.from("%PDF-1.4\nNội dung đơn kiến nghị của người dân " + tag)], {
      type: "application/pdf",
    }),
    `don-kien-nghi-${tag}.pdf`,
  );
  const uploadData = await ok(citizen, "/api/upload", form);

  const citizenDoc = await ok(citizen, "/api/citizen/submit-document", {
    senderName: "Nguyễn Văn Dân",
    senderPhone: "0988888888",
    senderEmail: "nguoidan@eoffice.local",
    senderAddress: "Hà Nội",
    docType: "Đơn kiến nghị / Phản ánh",
    title: `Đơn xin xác nhận và giải quyết thủ tục - ${tag}`,
    attachments: [{ uploadId: uploadData.uploadId }],
  });
  assert(citizenDoc.id, "Citizen doc must have id");
  console.log(`  [1] Người dân gửi đơn thành công. ID: ${citizenDoc.id}, Mã hồ sơ: ${citizenDoc.onlineCode}`);

  // BƯỚC 2: Chuyên viên tiếp nhận, kiểm tra và xử lý văn bản
  // 2a. Chuyên viên xem văn bản đang ở SUBMITTED
  const specView1 = await ok(specialist, `/api/documents/incoming/${citizenDoc.id}`);
  assert.equal(specView1.document.status, "SUBMITTED");
  const hasReceiveAction = specView1.allowedActions.some((a) => a.action === "RECEIVE_CITIZEN");
  assert(hasReceiveAction, "Specialist must have RECEIVE_CITIZEN action for SUBMITTED document");
  console.log("  [2a] Chuyên viên nhìn thấy đơn chờ tiếp nhận và có quyền 'Tiếp nhận & Vào sổ'");

  // 2b. Chuyên viên vào sổ (RECEIVE_CITIZEN)
  await ok(specialist, "/api/documents/transition", {
    documentId: citizenDoc.id,
    action: "RECEIVE_CITIZEN",
    documentBookId: incomingBook.id,
  });
  const specView2 = await ok(specialist, `/api/documents/incoming/${citizenDoc.id}`);
  assert.equal(specView2.document.status, "RECEIVED");
  assert(specView2.document.documentNumber, "Must have generated incoming document number");
  console.log(`  [2b] Chuyên viên đã vào sổ. Số đến: ${specView2.document.documentNumber}, Trạng thái: RECEIVED`);

  // 2c. Chuyên viên phân phối / tự thụ lý để vào PROCESSING
  const specUnitId = specialistUser.positions[0]?.unitId;
  await ok(specialist, "/api/documents/transition", {
    documentId: citizenDoc.id,
    action: "CLERK_DISTRIBUTE",
    unitId: specUnitId,
    headId: specialistUser.id,
    reason: "Chuyên viên tiếp nhận và trực tiếp thụ lý giải quyết hồ sơ",
  });
  const specView3 = await ok(specialist, `/api/documents/incoming/${citizenDoc.id}`);
  assert.equal(specView3.document.status, "PROCESSING");
  assert.equal(specView3.canReport, true, "Specialist should be able to report in PROCESSING");
  console.log("  [2c] Chuyên viên chuyển trạng thái sang PROCESSING (Đang xử lý) và có quyền nộp báo cáo kết quả");

  // 2d. Chuyên viên nộp báo cáo kết quả xử lý
  await ok(specialist, `/api/documents/incoming/${citizenDoc.id}/report`, {
    reportContent: "Đã thẩm định hồ sơ công dân đầy đủ, đủ điều kiện phê duyệt.",
  });
  const specView4 = await ok(specialist, `/api/documents/incoming/${citizenDoc.id}`);
  const hasSubmitReview = specView4.allowedActions.some((a) => a.action === "SUBMIT_REVIEW");
  assert(hasSubmitReview, "Specialist must have SUBMIT_REVIEW after reporting");
  console.log("  [2d] Chuyên viên nộp báo cáo kết quả thành công, xuất hiện quyền 'Trình Lãnh đạo duyệt'");

  // 2e. Chuyên viên trình Lãnh đạo
  await ok(specialist, "/api/documents/transition", {
    documentId: citizenDoc.id,
    action: "SUBMIT_REVIEW",
    reason: "Kính trình Lãnh đạo cơ quan xem xét phê duyệt kết quả giải quyết.",
  });
  const specView5 = await ok(specialist, `/api/documents/incoming/${citizenDoc.id}`);
  assert.equal(specView5.document.status, "PENDING_REVIEW");
  console.log("  [2e] Chuyên viên đã trình Lãnh đạo. Trạng thái chuyển sang PENDING_REVIEW (Chờ duyệt)");

  // BƯỚC 3: Lãnh đạo xem xét và phê duyệt kết quả
  const leaderView = await ok(leader, `/api/documents/incoming/${citizenDoc.id}`);
  assert.equal(leaderView.document.status, "PENDING_REVIEW");
  const hasApproveComplete = leaderView.allowedActions.some((a) => a.action === "APPROVE_COMPLETE");
  assert(hasApproveComplete, "Leader must have APPROVE_COMPLETE action in PENDING_REVIEW");
  console.log("  [3a] Lãnh đạo xem đơn và thấy báo cáo của chuyên viên, có quyền 'Phê duyệt kết quả'");

  // Lãnh đạo duyệt kết quả
  await ok(leader, "/api/documents/transition", {
    documentId: citizenDoc.id,
    action: "APPROVE_COMPLETE",
    reason: "Đồng ý với kết quả xử lý của chuyên viên. Phê duyệt kết quả giải quyết.",
  });
  const completedDoc = await ok(leader, `/api/documents/incoming/${citizenDoc.id}`);
  assert.equal(completedDoc.document.status, "COMPLETED");
  assert.equal(completedDoc.document.isLocked, true);
  console.log("  [3b] Lãnh đạo đã phê duyệt kết quả! Trạng thái: COMPLETED, Hồ sơ đã được khóa an toàn");

  // BƯỚC 4: Hoàn tất xử lý - Thông báo kết quả cho người dân
  const citizenNotifications = await ok(citizen, "/api/notifications");
  const hasCitizenNotification = (citizenNotifications.notifications || []).some(
    (n) => n.documentId === citizenDoc.id,
  );
  assert(hasCitizenNotification, "Citizen must receive notification upon completion");

  const citizenSubmissions = await ok(citizen, "/api/citizen/submit-document");
  const currentCitizenDoc = citizenSubmissions.find((d) => d.id === citizenDoc.id);
  assert.equal(currentCitizenDoc?.status, "COMPLETED", "Citizen view must show COMPLETED status");
  console.log("  [4] Người dân đã nhận thông báo kết quả và hồ sơ hiển thị trạng thái COMPLETED (Hoàn thành)!");
  console.log("--> PASS 100% LUỒNG VĂN BẢN ĐẾN (FLOW 1)!\n");

  // -------------------------------------------------------------
  // FLOW 2: LUỒNG VĂN BẢN ĐI
  // Lãnh đạo tạo hoặc duyệt VB đi -> Chọn người nhận: Chuyên viên (Chỉ đạo/Nhiệm vụ) HOẶC Người dân (Phản hồi)
  // -------------------------------------------------------------
  console.log("--- TEST FLOW 2: LUỒNG VĂN BẢN ĐI ---");

  const outgoingBook = await db.documentBook.findFirstOrThrow({ where: { bookType: "OUTGOING", isActive: true } });
  const leaderPos = await db.userPosition.findFirstOrThrow({ where: { userId: leaderUser.id, endedAt: null } });

  // Nhánh 2A: Lãnh đạo tạo văn bản đi chỉ đạo / giao nhiệm vụ cho Chuyên viên
  console.log("  [Luồng 2A] Lãnh đạo tạo văn bản đi chỉ đạo nội bộ gửi Chuyên viên:");
  const outDocSpec = await ok(leader, "/api/documents/outgoing", {
    title: `Chỉ đạo thực hiện nhiệm vụ rà soát thủ tục hành chính - ${tag}`,
    documentTypeId: docType.id,
    draftUnitId: leaderPos.unitId,
    documentBookId: outgoingBook.id,
    recipientType: "SPECIALIST",
    recipientId: specialistUser.id,
    summaryNotes: "Giao đồng chí Dung khẩn trương triển khai đúng tiến độ.",
    recipientsSummary: `Chuyên viên: ${specialistUser.fullName}`,
  });
  assert(outDocSpec.id, "Outgoing document for specialist must be created");

  // Kiểm tra Chuyên viên nhận thông báo và có DocumentHandler
  const specNotifications = await ok(specialist, "/api/notifications");
  const hasSpecNotification = (specNotifications.notifications || []).some(
    (n) => n.documentId === outDocSpec.id,
  );
  assert(hasSpecNotification, "Specialist must receive notification of new directive");

  const specHandler = await db.documentHandler.findFirst({
    where: { documentId: outDocSpec.id, assigneeId: specialistUser.id },
  });
  assert(specHandler, "Specialist must be assigned DocumentHandler for internal directive");
  console.log(`  [2A - OK] Văn bản đi đã tạo (ID: ${outDocSpec.id}). Chuyên viên đã nhận thông báo và được gán nhiệm vụ thành công!`);

  // Nhánh 2B: Lãnh đạo tạo văn bản đi phản hồi / thông báo kết quả gửi Người dân
  console.log("  [Luồng 2B] Lãnh đạo tạo văn bản đi phản hồi / trả lời Người dân:");
  const outDocCitizen = await ok(leader, "/api/documents/outgoing", {
    title: `Công văn thông báo kết quả giải quyết kiến nghị của công dân - ${tag}`,
    documentTypeId: docType.id,
    draftUnitId: leaderPos.unitId,
    documentBookId: outgoingBook.id,
    recipientType: "CITIZEN",
    recipientId: citizenUser.id,
    relatedDocumentId: citizenDoc.id,
    summaryNotes: "Thông báo kết quả giải quyết đơn kiến nghị.",
    recipientsSummary: `Người dân: ${citizenUser.fullName}`,
  });
  assert(outDocCitizen.id, "Outgoing document for citizen must be created");

  // Kiểm tra Người dân nhận được thông báo phản hồi
  const citizenNotifsAfter = await ok(citizen, "/api/notifications");
  const hasCitizenReplyNotif = (citizenNotifsAfter.notifications || []).some(
    (n) => n.documentId === outDocCitizen.id,
  );
  assert(hasCitizenReplyNotif, "Citizen must receive notification of outgoing reply");
  assert(hasCitizenReplyNotif, "Citizen must receive notification of outgoing reply");

  const relation = await db.documentRelation.findFirst({
    where: { sourceDocumentId: citizenDoc.id, targetDocumentId: outDocCitizen.id },
  });
  assert(relation, "Document relation REPLY_TO must be created linking incoming and outgoing doc");
  console.log(`  [2B - OK] Văn bản đi phản hồi đã tạo (ID: ${outDocCitizen.id}). Người dân nhận thông báo và liên kết hồ sơ REPLY_TO thành công!`);

  console.log("--> PASS 100% LUỒNG VĂN BẢN ĐI (FLOW 2)!\n");

  console.log("🎉 TẤT CẢ CÁC KIỂM THỬ CHO 4 VAI TRÒ & 2 LUỒNG ĐÃ ĐẠT 100%!");
}

runTests()
  .catch((err) => {
    console.error("LỖI KIỂM THỬ:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

