// tests/test-quynhmai-denied.mjs
const BASE = "http://localhost:3001";

async function run() {
  console.log("=== KIỂM TRA TÀI KHOẢN QUỲNH MAI SAU KHI BỊ BỎ QUYỀN ===");

  // 1. Đăng nhập Quỳnh Mai
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "Nquynhmai1104@gmail.com", password: "123456" }),
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    throw new Error("Login failed: " + JSON.stringify(loginData));
  }
  const cookie = loginRes.headers.get("set-cookie");
  console.log("1. Đăng nhập thành công với tài khoản Quỳnh Mai.");

  // 2. Kiểm tra /api/auth/me
  const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } });
  const meData = await meRes.json();
  const permissions = meData.data?.permissions || {};
  console.log("2. Danh sách quyền hiện có của Quỳnh Mai:");
  console.log(Object.keys(permissions));

  const deniedCodes = [
    "doc.incoming.view",
    "doc.incoming.register",
    "doc.incoming.create",
    "doc.incoming.process",
    "doc.incoming.assign",
    "doc.incoming.forward",
    "archive.manage",
    "archive.view",
  ];

  console.log("3. Kiểm tra các quyền đã bị bỏ:");
  for (const code of deniedCodes) {
    const has = Boolean(permissions[code]);
    console.log(`   - Quyền "${code}": ${has ? "VẪN CÒN (LỖI)" : "ĐÃ BỊ BỎ TRIỆT ĐỂ (ĐÚNG)"}`);
    if (has) throw new Error(`Quyền ${code} vẫn còn trong permissions!`);
  }

  // 4. Thử truy cập API văn bản đến
  console.log("4. Kiểm tra API GET /api/documents/incoming:");
  const incRes = await fetch(`${BASE}/api/documents/incoming`, { headers: { Cookie: cookie } });
  const incData = await incRes.json();
  console.log(`   - HTTP Status: ${incRes.status} (Kỳ vọng: 403 FORBIDDEN)`);
  console.log(`   - Error Message: ${incData.error?.message}`);
  if (incRes.status !== 403) {
    throw new Error("GET /api/documents/incoming không chặn quyền 403!");
  }

  // 5. Thử gọi API POST /api/documents/incoming (Vào sổ văn bản đến)
  console.log("5. Kiểm tra API POST /api/documents/incoming:");
  const postIncRes = await fetch(`${BASE}/api/documents/incoming`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      title: "Test doc created by unauthorized user",
      receivedDate: new Date().toISOString(),
      documentTypeId: "CV",
    }),
  });
  const postIncData = await postIncRes.json();
  console.log(`   - HTTP Status: ${postIncRes.status} (Kỳ vọng: 403 FORBIDDEN)`);
  console.log(`   - Error Message: ${postIncData.error?.message}`);
  if (postIncRes.status !== 403) {
    throw new Error("POST /api/documents/incoming không chặn quyền 403!");
  }

  // 6. Thử gọi API GET /api/archives (Hồ sơ công việc)
  console.log("6. Kiểm tra API GET /api/archives:");
  const archRes = await fetch(`${BASE}/api/archives`, { headers: { Cookie: cookie } });
  const archData = await archRes.json();
  console.log(`   - HTTP Status: ${archRes.status} (Kỳ vọng: 403 FORBIDDEN)`);
  console.log(`   - Error Message: ${archData.error?.message}`);
  if (archRes.status !== 403) {
    throw new Error("GET /api/archives không chặn quyền 403!");
  }

  console.log("\n=== TẤT CẢ KIỂM TRA BẢO MẬT CHO TÀI KHOẢN QUỲNH MAI ĐẠT 100%! ===");
}

run().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
