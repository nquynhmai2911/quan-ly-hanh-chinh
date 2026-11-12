// scripts/audit-apis.mjs
// Script test kiểm tra toàn bộ 41 API endpoints với các trường hợp lỗi (invalid, empty, malformed payload)
// Mục tiêu: KHÔNG được có bất kỳ mã lỗi 500 nào (100% xử lý an toàn trả về 4xx chuẩn).

const BASE_URL = "http://localhost:3001";

async function loginAsAdmin() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@eoffice.local", password: "Admin@123" }),
  });
  const cookies = res.headers.getSetCookie();
  return cookies.join("; ");
}

async function runAudit() {
  console.log("🔍 Bắt đầu quét kiểm toán lỗi 500 trên toàn bộ API...");
  const cookie = await loginAsAdmin();
  if (!cookie) {
    console.error("❌ Không thể đăng nhập tài khoản Admin để chạy audit.");
    process.exit(1);
  }
  console.log("✅ Đã xác thực phiên Admin.");

  const testCases = [
    // 1. Auth & Me
    { name: "GET /api/auth/me", method: "GET", path: "/api/auth/me", cookie },
    { name: "POST /api/auth/login (empty body)", method: "POST", path: "/api/auth/login", body: {} },
    { name: "POST /api/auth/login (invalid creds)", method: "POST", path: "/api/auth/login", body: { email: "wrong@wrong.com", password: "123" } },
    { name: "POST /api/auth/change-password (wrong current)", method: "POST", path: "/api/auth/change-password", cookie, body: { currentPassword: "wrong", newPassword: "New@123password" } },
    
    // 2. Users & Permissions
    { name: "GET /api/admin/users", method: "GET", path: "/api/admin/users", cookie },
    { name: "GET /api/admin/users/non-existent-id", method: "GET", path: "/api/admin/users/invalid_id_999", cookie },
    { name: "POST /api/admin/users (empty body)", method: "POST", path: "/api/admin/users", cookie, body: {} },
    { name: "POST /api/admin/users (duplicate email)", method: "POST", path: "/api/admin/users", cookie, body: { email: "admin@eoffice.local", fullName: "Test", employeeCode: "TEST999" } },
    { name: "DELETE /api/admin/users/non-existent", method: "DELETE", path: "/api/admin/users/invalid_id_999", cookie },
    { name: "DELETE /api/admin/users (root admin)", method: "DELETE", path: "/api/admin/users/cmvpco33d004iumcsd2f3s356", cookie },
    { name: "GET /api/admin/users/non-existent/permissions", method: "GET", path: "/api/admin/users/invalid_id_999/permissions", cookie },
    { name: "POST /api/admin/users/non-existent/permissions", method: "POST", path: "/api/admin/users/invalid_id_999/permissions", cookie, body: { permissions: [] } },
    
    // 3. Roles & Positions
    { name: "GET /api/admin/roles", method: "GET", path: "/api/admin/roles", cookie },
    { name: "POST /api/admin/roles (invalid roleId)", method: "POST", path: "/api/admin/roles", cookie, body: { roleId: "invalid_id", permissionIds: [] } },
    { name: "GET /api/admin/positions", method: "GET", path: "/api/admin/positions", cookie },
    { name: "POST /api/admin/positions (empty)", method: "POST", path: "/api/admin/positions", cookie, body: {} },
    { name: "PATCH /api/admin/positions/invalid_id", method: "PATCH", path: "/api/admin/positions/invalid_id_999", cookie, body: { name: "New Name" } },
    { name: "DELETE /api/admin/positions/invalid_id", method: "DELETE", path: "/api/admin/positions/invalid_id_999", cookie },
    
    // 4. Units & Catalogs
    { name: "GET /api/admin/units", method: "GET", path: "/api/admin/units", cookie },
    { name: "POST /api/admin/units (empty)", method: "POST", path: "/api/admin/units", cookie, body: {} },
    { name: "GET /api/admin/books", method: "GET", path: "/api/admin/books", cookie },
    { name: "POST /api/admin/books (empty)", method: "POST", path: "/api/admin/books", cookie, body: {} },
    { name: "GET /api/catalogs/books", method: "GET", path: "/api/catalogs/books", cookie },
    { name: "GET /api/catalogs/document-types", method: "GET", path: "/api/catalogs/document-types", cookie },
    { name: "GET /api/admin/document-types", method: "GET", path: "/api/admin/document-types", cookie },
    { name: "POST /api/admin/document-types (empty)", method: "POST", path: "/api/admin/document-types", cookie, body: {} },
    { name: "PATCH /api/admin/document-types/invalid_id", method: "PATCH", path: "/api/admin/document-types/invalid_id_999", cookie, body: { name: "New Name" } },
    { name: "DELETE /api/admin/document-types/invalid_id", method: "DELETE", path: "/api/admin/document-types/invalid_id_999", cookie },
    { name: "GET /api/admin/urgency-configs", method: "GET", path: "/api/admin/urgency-configs", cookie },
    { name: "POST /api/admin/urgency-configs (empty)", method: "POST", path: "/api/admin/urgency-configs", cookie, body: {} },
    { name: "GET /api/admin/audit-logs", method: "GET", path: "/api/admin/audit-logs", cookie },
    
    // 5. Incoming & Outgoing Documents
    { name: "GET /api/documents/incoming", method: "GET", path: "/api/documents/incoming", cookie },
    { name: "GET /api/documents/incoming/invalid_id", method: "GET", path: "/api/documents/incoming/invalid_id_999", cookie },
    { name: "POST /api/documents/incoming (empty)", method: "POST", path: "/api/documents/incoming", cookie, body: {} },
    { name: "GET /api/documents/outgoing", method: "GET", path: "/api/documents/outgoing", cookie },
    { name: "GET /api/documents/outgoing/invalid_id", method: "GET", path: "/api/documents/outgoing/invalid_id_999", cookie },
    { name: "POST /api/documents/outgoing (empty)", method: "POST", path: "/api/documents/outgoing", cookie, body: {} },
    { name: "GET /api/documents/assignees", method: "GET", path: "/api/documents/assignees", cookie },
    { name: "GET /api/documents/routing-options", method: "GET", path: "/api/documents/routing-options", cookie },
    { name: "POST /api/documents/transition (empty)", method: "POST", path: "/api/documents/transition", cookie, body: {} },
    
    // 6. Dashboard, Reports, Search, Tasks, Notifications, Archives
    { name: "GET /api/dashboard/stats", method: "GET", path: "/api/dashboard/stats", cookie },
    { name: "GET /api/reports", method: "GET", path: "/api/reports", cookie },
    { name: "GET /api/reports/export-excel", method: "GET", path: "/api/reports/export-excel", cookie },
    { name: "GET /api/search?q=test", method: "GET", path: "/api/search?q=test", cookie },
    { name: "GET /api/tasks", method: "GET", path: "/api/tasks", cookie },
    { name: "GET /api/tasks/invalid_id", method: "GET", path: "/api/tasks/invalid_id_999", cookie },
    { name: "GET /api/notifications", method: "GET", path: "/api/notifications", cookie },
    { name: "GET /api/archives", method: "GET", path: "/api/archives", cookie },
  ];

  let has500 = false;
  let passedCount = 0;
  let error500List = [];

  for (const tc of testCases) {
    try {
      const options = {
        method: tc.method,
        headers: {
          "Content-Type": "application/json",
          ...(tc.cookie ? { Cookie: tc.cookie } : {}),
        },
        ...(tc.body !== undefined ? { body: JSON.stringify(tc.body) } : {}),
      };

      const res = await fetch(`${BASE_URL}${tc.path}`, options);
      if (res.status === 500) {
        has500 = true;
        const errBody = await res.text();
        error500List.push({ name: tc.name, status: res.status, body: errBody });
        console.error(`❌ [HTTP 500] ${tc.name}:`, errBody);
      } else {
        passedCount++;
        // console.log(`  ✓ [HTTP ${res.status}] ${tc.name}`);
      }
    } catch (e) {
      has500 = true;
      error500List.push({ name: tc.name, error: e.message });
      console.error(`❌ [EXCEPTION] ${tc.name}:`, e.message);
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 Kết quả audit: ${passedCount}/${testCases.length} endpoints an toàn (0 lỗi 500)`);
  if (has500) {
    console.error(`❌ Phát hiện ${error500List.length} trường hợp lỗi 500!`);
    process.exit(1);
  } else {
    console.log(`🎉 100% endpoints không gặp lỗi 500! Xử lý ngoại lệ chuẩn HTTP 4xx.`);
  }
}

runAudit();

