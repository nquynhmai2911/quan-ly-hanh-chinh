// tests/test-admin-deny-permission.mjs
// Kiểm tra Admin tước/bỏ quyền cá nhân đối với một tài khoản bất kỳ (ngay cả quyền kế thừa từ Vai trò)

const BASE = "http://localhost:3001";

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
  }
  const cookie = res.headers.get("set-cookie");
  return { token: data.data.accessToken, cookie };
}

async function api(path, options = {}, auth = null) {
  const headers = {
    "Content-Type": "application/json",
    ...(auth?.cookie ? { Cookie: auth.cookie } : {}),
    ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log("=== BẮT ĐẦU KIỂM TRA TÍNH NĂNG ADMIN BỎ QUYỀN BẤT KỲ CHO TÀI KHOẢN ===");

  // 1. Đăng nhập Admin
  console.log("1. Đăng nhập tài khoản Admin...");
  const admin = await login("admin@eoffice.local", "Admin@123");
  console.log("   Admin login OK.");

  // 2. Tìm tài khoản Chuyên viên (chuyenvien.tchc@eoffice.local)
  console.log("2. Tìm tài khoản Chuyên viên...");
  const usersRes = await api("/api/admin/users?pageSize=100", {}, admin);
  const specialistUser = usersRes.data?.data?.find(u => u.email === "chuyenvien.tchc@eoffice.local") || usersRes.data?.data?.[0];
  if (!specialistUser) {
    throw new Error("Không tìm thấy user nào trong danh sách!");
  }
  console.log(`   Tìm thấy: ${specialistUser.fullName} (${specialistUser.email}) (ID: ${specialistUser.id})`);

  // 3. Lấy thông tin phân quyền hiện tại
  console.log("3. Lấy ma trận quyền của người dùng...");
  const permRes = await api(`/api/admin/users/${specialistUser.id}/permissions`, {}, admin);
  const permData = permRes.data?.data;
  console.log(`   - Kế thừa từ vai trò: ${permData.inheritedPermissionIds.length} quyền`);
  console.log(`   - Cấp riêng: ${permData.directPermissions.length} quyền`);
  console.log(`   - Đã bỏ quyền: ${permData.deniedPermissionIds?.length || 0} quyền`);

  // Chọn 1 quyền từ vai trò để bỏ quyền, ví dụ archive.view hoặc catalog.view
  const targetPermId = permData.inheritedPermissionIds[0];
  const targetPerm = permData.allPermissions.find(p => p.id === targetPermId);
  console.log(`   -> Chọn quyền thử nghiệm để bỏ: "${targetPerm.name}" (${targetPerm.code})`);

  // 4. Admin thực hiện BỎ QUYỀN này (gửi deniedPermissionIds)
  console.log(`4. Admin bỏ quyền "${targetPerm.name}"...`);
  const updateRes = await api(
    `/api/admin/users/${specialistUser.id}/permissions`,
    {
      method: "POST",
      body: JSON.stringify({
        permissions: permData.directPermissions.map(dp => ({ permissionId: dp.permissionId, dataScope: dp.dataScope })),
        deniedPermissionIds: [targetPermId],
      }),
    },
    admin
  );
  if (updateRes.status !== 200 || !updateRes.data.success) {
    throw new Error(`Cập nhật quyền thất bại: ${JSON.stringify(updateRes.data)}`);
  }
  console.log("   Admin lưu thành công!");

  // 5. Kiểm tra lại API permissions xem deniedPermissionIds đã lưu chưa
  console.log("5. Kiểm tra lại API permissions...");
  const verifyRes = await api(`/api/admin/users/${specialistUser.id}/permissions`, {}, admin);
  const verifyData = verifyRes.data?.data;
  if (!verifyData.deniedPermissionIds.includes(targetPermId)) {
    throw new Error("Quyền chưa được đưa vào danh sách deniedPermissionIds!");
  }
  console.log("   Xác nhận: Quyền đã nằm trong deniedPermissionIds của API.");

  // 6. Đăng nhập tài khoản Chuyên viên và kiểm tra /api/auth/me
  console.log(`6. Đăng nhập tài khoản Chuyên viên (${specialistUser.email}) để kiểm tra hiệu lực tức thì...`);
  const specialist = await login(specialistUser.email, specialistUser.email.startsWith("admin") ? "Admin@123" : "Demo@123");
  const meRes = await api("/api/auth/me", {}, specialist);
  const myPermissions = meRes.data?.data?.permissions || {};
  const hasDeniedPerm = Boolean(myPermissions[targetPerm.code]);
  console.log(`   Chuyên viên có còn quyền "${targetPerm.code}" không? -> ${hasDeniedPerm ? "CÒN (LỖI)" : "ĐÃ BỊ TƯỚC THÀNH CÔNG (ĐÚNG)"}`);
  if (hasDeniedPerm) {
    throw new Error(`LỖI: Quyền ${targetPerm.code} vẫn còn tồn tại trong auth context!`);
  }

  // 7. Admin khôi phục lại quyền cho Chuyên viên (xóa khỏi denied)
  console.log("7. Admin khôi phục lại quyền mặc định...");
  const restoreRes = await api(
    `/api/admin/users/${specialistUser.id}/permissions`,
    {
      method: "POST",
      body: JSON.stringify({
        permissions: permData.directPermissions.map(dp => ({ permissionId: dp.permissionId, dataScope: dp.dataScope })),
        deniedPermissionIds: [],
      }),
    },
    admin
  );
  console.log("   Khôi phục thành công.");

  // 8. Đăng nhập lại Chuyên viên và kiểm tra quyền đã được phục hồi
  console.log("8. Kiểm tra lại Chuyên viên sau khi khôi phục...");
  const meRestoredRes = await api("/api/auth/me", {}, specialist);
  const myRestoredPermissions = meRestoredRes.data?.data?.permissions || {};
  const restoredPerm = Boolean(myRestoredPermissions[targetPerm.code]);
  console.log(`   Chuyên viên đã lấy lại quyền "${targetPerm.code}" chưa? -> ${restoredPerm ? "ĐÃ LẤY LẠI (ĐÚNG)" : "CHƯA (LỖI)"}`);
  if (!restoredPerm) {
    throw new Error(`LỖI: Quyền ${targetPerm.code} chưa được phục hồi!`);
  }

  console.log("=== TẤT CẢ KIỂM TRA THÀNH CÔNG 100%! TÍNH NĂNG ADMIN BỎ QUYỀN ĐÃ HOÀN HẢO! ===");
}

run().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
