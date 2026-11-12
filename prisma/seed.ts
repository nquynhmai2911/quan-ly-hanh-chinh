// prisma/seed.ts
// Seed dữ liệu khởi tạo hệ thống chuẩn hóa: 4 Vai trò (Quản trị viên, Lãnh đạo, Chuyên viên, Người dân)
// Chạy: npx prisma db seed

import { PrismaClient, DataScope } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

async function main() {
  console.log("🌱 Khởi tạo Database với 4 vai trò chuẩn hóa...");

  // ── 0. Xóa dữ liệu cũ để tránh xung đột ──────────────────────────────────
  console.log("🧹 Đang dọn dẹp dữ liệu cũ...");
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      audit_logs,
      notifications,
      document_readers,
      document_relations,
      archive_documents,
      document_approvals,
      document_signatures,
      document_files,
      document_handlers,
      incoming_workflows,
      pending_uploads,
      documents,
      document_book_counters,
      document_books,
      user_permissions,
      user_position_roles,
      user_positions,
      role_permissions,
      roles,
      positions,
      permissions,
      archives,
      external_organizations,
      fields,
      document_types,
      units,
      users
    CASCADE;
  `);
  console.log("  ✅ Đã dọn dẹp sạch toàn bộ dữ liệu cũ");

  // ── 1. Chức danh (Không còn chức danh Văn thư) ───────────────────────────
  const positionsData = [
    { name: "Quản trị hệ thống", level: 0 },
    { name: "Lãnh đạo", level: 1 },
    { name: "Chuyên viên", level: 2 },
    { name: "Người dân", level: 3 },
  ];

  const positions: Record<string, string> = {};
  for (const p of positionsData) {
    const pos = await prisma.position.create({
      data: p,
    });
    positions[p.name] = pos.id;
  }
  console.log(`  ✅ ${positionsData.length} chức danh chuẩn`);

  // ── 2. Đơn vị / Phòng ban ────────────────────────────────────────────────
  const rootUnit = await prisma.unit.create({
    data: {
      name: "Cơ quan",
      code: "CQ",
      level: 0,
      sortOrder: 0,
    },
  });

  const departmentsData = [
    { name: "Phòng Tổ chức - Hành chính", code: "TCHC", sortOrder: 1 },
    { name: "Phòng Kế hoạch - Tài chính", code: "KHTC", sortOrder: 2 },
    { name: "Phòng Nghiệp vụ 1", code: "NV1", sortOrder: 3 },
    { name: "Phòng Nghiệp vụ 2", code: "NV2", sortOrder: 4 },
    { name: "Văn phòng", code: "VP", sortOrder: 5 },
  ];

  const units: Record<string, string> = { CQ: rootUnit.id };
  for (const d of departmentsData) {
    const unit = await prisma.unit.create({
      data: {
        ...d,
        parentId: rootUnit.id,
        level: 1,
      },
    });
    units[d.code] = unit.id;
  }
  console.log(`  ✅ ${departmentsData.length + 1} đơn vị / phòng ban`);

  // ── 3. Vai trò (ĐÚNG 4 ROLES DUY NHẤT) ───────────────────────────────────
  const rolesData = [
    {
      code: "ADMIN",
      name: "Quản trị viên",
      description: "Quản trị người dùng, cơ cấu phòng ban, phân quyền vai trò, cấu hình sổ văn bản, xem Audit Log an toàn",
    },
    {
      code: "LEADER",
      name: "Lãnh đạo",
      description: "Cho ý kiến chỉ đạo bút phê văn bản đến, phân công đơn vị, duyệt sơ bộ, phê duyệt và ký duyệt văn bản đi",
    },
    {
      code: "SPECIALIST",
      name: "Chuyên viên",
      description: "Tiếp nhận vào sổ văn bản đến, thụ lý văn bản, báo cáo tiến độ, soạn dự thảo văn bản đi, cấp số và phát hành",
    },
    {
      code: "CITIZEN",
      name: "Người dân",
      description: "Nộp hồ sơ / văn bản trực tuyến qua cổng dịch vụ công và theo dõi kết quả giải quyết",
    },
  ];

  const roles: Record<string, string> = {};
  for (const r of rolesData) {
    const role = await prisma.role.create({
      data: { ...r, isSystem: true },
    });
    roles[r.code] = role.id;
  }
  console.log(`  ✅ Đúng ${rolesData.length} vai trò hệ thống: ADMIN, LEADER, SPECIALIST, CITIZEN`);

  // ── 4. Quyền (Permissions) ────────────────────────────────────────────────
  const permissionsData = [
    // Văn bản đến
    { code: "doc.incoming.view", name: "Xem văn bản đến", module: "doc.incoming" },
    { code: "doc.incoming.create", name: "Tiếp nhận văn bản đến", module: "doc.incoming" },
    { code: "doc.incoming.register", name: "Vào sổ văn bản đến", module: "doc.incoming" },
    { code: "doc.incoming.forward", name: "Trình văn bản đến", module: "doc.incoming" },
    { code: "doc.incoming.annotate", name: "Bút phê văn bản đến", module: "doc.incoming" },
    { code: "doc.incoming.assign", name: "Phân công xử lý", module: "doc.incoming" },
    { code: "doc.incoming.process", name: "Xử lý văn bản đến", module: "doc.incoming" },
    { code: "doc.incoming.complete", name: "Xác nhận hoàn thành", module: "doc.incoming" },

    // Văn bản đi
    { code: "doc.outgoing.view", name: "Xem văn bản đi", module: "doc.outgoing" },
    { code: "doc.outgoing.create", name: "Tạo dự thảo văn bản đi", module: "doc.outgoing" },
    { code: "doc.outgoing.review", name: "Duyệt sơ bộ văn bản đi", module: "doc.outgoing" },
    { code: "doc.outgoing.approve", name: "Duyệt/ký văn bản đi", module: "doc.outgoing" },
    { code: "doc.outgoing.sign", name: "Phê duyệt điện tử", module: "doc.outgoing" },
    { code: "doc.outgoing.number", name: "Cấp số văn bản đi", module: "doc.outgoing" },
    { code: "doc.outgoing.issue", name: "Ban hành văn bản đi", module: "doc.outgoing" },
    { code: "doc.outgoing.recall", name: "Thu hồi văn bản", module: "doc.outgoing" },
    { code: "doc.outgoing.replace", name: "Thay thế văn bản", module: "doc.outgoing" },
    { code: "doc.outgoing.cancel", name: "Hủy văn bản", module: "doc.outgoing" },

    // Danh mục
    { code: "catalog.view", name: "Xem danh mục", module: "catalog" },
    { code: "catalog.manage", name: "Quản lý danh mục", module: "catalog" },

    // Quản trị
    { code: "admin.user.manage", name: "Quản lý người dùng", module: "admin" },
    { code: "admin.role.manage", name: "Quản lý phân quyền", module: "admin" },
    { code: "admin.unit.manage", name: "Quản lý đơn vị", module: "admin" },
    { code: "admin.system", name: "Cấu hình hệ thống", module: "admin" },

    // Hồ sơ lưu trữ
    { code: "archive.view", name: "Xem hồ sơ lưu trữ", module: "archive" },
    { code: "archive.manage", name: "Quản lý hồ sơ lưu trữ", module: "archive" },

    // Thông báo
    { code: "notification.view", name: "Xem thông báo", module: "notification" },
  ];

  const perms: Record<string, string> = {};
  for (const p of permissionsData) {
    const perm = await prisma.permission.create({
      data: p,
    });
    perms[p.code] = perm.id;
  }
  console.log(`  ✅ ${permissionsData.length} quyền hệ thống`);

  // ── 5. Gán quyền cho 4 vai trò ───────────────────────────────────────────
  const rolePermissionMap: Record<string, string[]> = {
    ADMIN: [
      "admin.user.manage",
      "admin.role.manage",
      "admin.unit.manage",
      "admin.system",
      "catalog.view",
      "catalog.manage",
      "archive.view",
      "archive.manage",
      "notification.view",
      "doc.incoming.view",
      "doc.incoming.create",
      "doc.outgoing.view",
      "doc.outgoing.create",
    ],
    LEADER: [
      "doc.incoming.view",
      "doc.incoming.create",
      "doc.incoming.register",
      "doc.incoming.forward",
      "doc.incoming.annotate",
      "doc.incoming.assign",
      "doc.incoming.process",
      "doc.incoming.complete",
      "doc.outgoing.view",
      "doc.outgoing.create",
      "doc.outgoing.review",
      "doc.outgoing.approve",
      "doc.outgoing.sign",
      "doc.outgoing.number",
      "doc.outgoing.issue",
      "doc.outgoing.recall",
      "doc.outgoing.replace",
      "doc.outgoing.cancel",
      "catalog.view",
      "catalog.manage",
      "archive.view",
      "archive.manage",
      "notification.view",
    ],
    SPECIALIST: [
      "doc.incoming.view",
      "doc.incoming.create",
      "doc.incoming.register",
      "doc.incoming.forward",
      "doc.incoming.assign",
      "doc.incoming.process",
      "doc.incoming.complete",
      "doc.outgoing.view",
      "doc.outgoing.create",
      "doc.outgoing.review",
      "doc.outgoing.number",
      "doc.outgoing.issue",
      "doc.outgoing.cancel",
      "catalog.view",
      "archive.view",
      "archive.manage",
      "notification.view",
    ],
    CITIZEN: [
      "notification.view",
    ],
  };

  let rpCount = 0;
  for (const [roleCode, permCodes] of Object.entries(rolePermissionMap)) {
    for (const permCode of permCodes) {
      await prisma.rolePermission.create({
        data: {
          roleId: roles[roleCode],
          permissionId: perms[permCode],
        },
      });
      rpCount++;
    }
  }
  console.log(`  ✅ ${rpCount} gán quyền cho 4 vai trò`);

  // ── 6. Loại văn bản ───────────────────────────────────────────────────────
  const docTypesData = [
    { name: "Công văn", code: "CV", sortOrder: 1 },
    { name: "Tờ trình", code: "TTr", sortOrder: 2 },
    { name: "Quyết định", code: "QĐ", sortOrder: 3 },
    { name: "Báo cáo", code: "BC", sortOrder: 4 },
    { name: "Thông báo", code: "TB", sortOrder: 5 },
    { name: "Kế hoạch", code: "KH", sortOrder: 6 },
    { name: "Biên bản", code: "BB", sortOrder: 7 },
    { name: "Hợp đồng", code: "HĐ", sortOrder: 8 },
    { name: "Giấy mời", code: "GM", sortOrder: 9 },
    { name: "Chỉ thị", code: "CT", sortOrder: 10 },
  ];

  const docTypes: Record<string, string> = {};
  for (const dt of docTypesData) {
    const docType = await prisma.documentType.create({
      data: dt,
    });
    docTypes[dt.code] = docType.id;
  }
  console.log(`  ✅ ${docTypesData.length} loại văn bản`);

  // ── 7. Lĩnh vực ──────────────────────────────────────────────────────────
  const fieldsData = [
    { name: "Tổ chức cán bộ", code: "TCCB", sortOrder: 1 },
    { name: "Kế hoạch tài chính", code: "KHTC", sortOrder: 2 },
    { name: "Hành chính tổng hợp", code: "HCTH", sortOrder: 3 },
    { name: "Nghiệp vụ chuyên môn", code: "NVCM", sortOrder: 4 },
    { name: "Thanh tra kiểm tra", code: "TTKT", sortOrder: 5 },
  ];

  for (const f of fieldsData) {
    await prisma.field.create({
      data: f,
    });
  }
  console.log(`  ✅ ${fieldsData.length} lĩnh vực`);

  // ── 8. Cơ quan bên ngoài mẫu ──────────────────────────────────────────────
  const externalOrgsData = [
    { name: "Bộ Nội vụ", code: "BNV" },
    { name: "UBND Tỉnh", code: "UBNDT" },
    { name: "Sở Nội vụ", code: "SNV" },
    { name: "Sở Tài chính", code: "STC" },
    { name: "Sở Kế hoạch và Đầu tư", code: "SKHDT" },
  ];

  for (const org of externalOrgsData) {
    await prisma.externalOrganization.create({
      data: org,
    });
  }
  console.log(`  ✅ ${externalOrgsData.length} cơ quan bên ngoài`);

  // ── 9. Sổ văn bản ─────────────────────────────────────────────────────────
  const booksData = [
    {
      name: "Sổ văn bản đến chung",
      code: "SVB-DEN",
      bookType: "INCOMING" as const,
      numberTemplate: "{number}",
    },
    {
      name: "Sổ Công văn đi - TCHC",
      code: "SCV-TCHC",
      bookType: "OUTGOING" as const,
      unitId: units["TCHC"],
      documentTypeId: docTypes["CV"],
      numberTemplate: "{number}/{typeCode}-{unitCode}",
    },
    {
      name: "Sổ Quyết định",
      code: "SQD",
      bookType: "OUTGOING" as const,
      documentTypeId: docTypes["QĐ"],
      numberTemplate: "{number}/{typeCode}-{unitCode}",
    },
    {
      name: "Sổ Công văn đi - KHTC",
      code: "SCV-KHTC",
      bookType: "OUTGOING" as const,
      unitId: units["KHTC"],
      documentTypeId: docTypes["CV"],
      numberTemplate: "{number}/{typeCode}-{unitCode}",
    },
  ];

  const currentYear = new Date().getFullYear();
  for (const b of booksData) {
    const book = await prisma.documentBook.create({
      data: b,
    });

    await prisma.documentBookCounter.create({
      data: {
        bookId: book.id,
        year: currentYear,
        lastNumber: 0,
      },
    });
  }
  console.log(`  ✅ ${booksData.length} sổ văn bản`);

  // ── 10. Danh sách tài khoản người dùng ────────────────────────────────────
  // Gồm: Quản trị viên, Người dân, nhiều Chuyên viên ngang cấp, nhiều Lãnh đạo phụ trách phòng ban
  const seedAccounts = [
    // 10.1 Quản trị viên
    {
      employeeCode: "ADMIN001",
      fullName: "Quản trị viên hệ thống",
      email: "admin@eoffice.local",
      password: "Admin@123",
      positionName: "Quản trị hệ thống",
      unitCode: "CQ",
      roleCode: "ADMIN",
      dataScope: DataScope.ALL,
    },
    // 10.2 Người dân / Doanh nghiệp
    {
      employeeCode: "CD001",
      fullName: "Nguyễn Văn Dân",
      email: "nguoidan@eoffice.local",
      password: "Demo@123",
      positionName: "Người dân",
      unitCode: "CQ",
      roleCode: "CITIZEN",
      dataScope: DataScope.OWN,
    },

    // 10.3 Nhóm Chuyên viên ngang cấp nhau ở các phòng ban
    {
      employeeCode: "CV001",
      fullName: "Phạm Thị Dung",
      email: "chuyenvien.tchc@eoffice.local",
      password: "Demo@123",
      positionName: "Chuyên viên",
      unitCode: "TCHC",
      roleCode: "SPECIALIST",
      dataScope: DataScope.ALL,
    },
    {
      employeeCode: "CV002",
      fullName: "Trần Đức Long",
      email: "chuyenvien2.tchc@eoffice.local",
      password: "Demo@123",
      positionName: "Chuyên viên",
      unitCode: "TCHC",
      roleCode: "SPECIALIST",
      dataScope: DataScope.ALL,
    },
    {
      employeeCode: "CV003",
      fullName: "Hoàng Thị Mai",
      email: "chuyenvien.khtc@eoffice.local",
      password: "Demo@123",
      positionName: "Chuyên viên",
      unitCode: "KHTC",
      roleCode: "SPECIALIST",
      dataScope: DataScope.ALL,
    },
    {
      employeeCode: "CV004",
      fullName: "Vũ Minh Tuấn",
      email: "chuyenvien.nv1@eoffice.local",
      password: "Demo@123",
      positionName: "Chuyên viên",
      unitCode: "NV1",
      roleCode: "SPECIALIST",
      dataScope: DataScope.ALL,
    },

    // 10.4 Nhóm Lãnh đạo phụ trách các phòng ban khác nhau (Hợp nhất chung vai trò LEADER)
    {
      employeeCode: "GD001",
      fullName: "Lãnh đạo Cơ quan",
      email: "giamdoc@eoffice.local",
      password: "Demo@123",
      positionName: "Lãnh đạo",
      unitCode: "CQ",
      roleCode: "LEADER",
      dataScope: DataScope.ALL,
    },
    {
      employeeCode: "TP001",
      fullName: "Trần Thị Bình",
      email: "truongphong.tchc@eoffice.local",
      password: "Demo@123",
      positionName: "Lãnh đạo",
      unitCode: "TCHC",
      roleCode: "LEADER",
      dataScope: DataScope.ALL,
    },
    {
      employeeCode: "LD002",
      fullName: "Lê Văn Đức",
      email: "lanhdao.khtc@eoffice.local",
      password: "Demo@123",
      positionName: "Lãnh đạo",
      unitCode: "KHTC",
      roleCode: "LEADER",
      dataScope: DataScope.ALL,
    },
    {
      employeeCode: "LD003",
      fullName: "Phạm Quốc Hùng",
      email: "lanhdao.nv1@eoffice.local",
      password: "Demo@123",
      positionName: "Lãnh đạo",
      unitCode: "NV1",
      roleCode: "LEADER",
      dataScope: DataScope.ALL,
    },
  ];

  for (const acc of seedAccounts) {
    const user = await prisma.user.create({
      data: {
        employeeCode: acc.employeeCode,
        fullName: acc.fullName,
        email: acc.email,
        passwordHash: hashPassword(acc.password),
        isActive: true,
      },
    });

    const up = await prisma.userPosition.create({
      data: {
        userId: user.id,
        unitId: units[acc.unitCode],
        positionId: positions[acc.positionName],
        isPrimary: true,
        startedAt: new Date("2024-01-01"),
      },
    });

    await prisma.userPositionRole.create({
      data: {
        userPositionId: up.id,
        roleId: roles[acc.roleCode],
        dataScope: acc.dataScope,
      },
    });
  }

  console.log(`  ✅ ${seedAccounts.length} tài khoản khởi tạo thành công (Admin, Dân, Chuyên viên ngang cấp, Lãnh đạo các phòng ban)`);
  console.log("\n🎉 Seed database hoàn tất thành công!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
