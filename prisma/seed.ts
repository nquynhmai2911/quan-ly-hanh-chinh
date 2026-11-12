// prisma/seed.ts
// Seed dữ liệu khởi tạo: vai trò, quyền, đơn vị gốc, admin mặc định
// Chạy: npx prisma db seed

import { PrismaClient, DataScope } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

// ── Hash password đơn giản (Phase 2 sẽ dùng bcrypt) ───────────────────────
function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

async function main() {
  console.log("🌱 Seeding database...");

  // ── 1. Chức danh ──────────────────────────────────────────────────────────
  const positionsData = [
    { name: "Quản trị hệ thống", level: 0 },
    { name: "Lãnh đạo", level: 1 },
    { name: "Chuyên viên", level: 2 },
    { name: "Văn thư", level: 3 },
  ];

  const positions: Record<string, string> = {};
  for (const p of positionsData) {
    const pos = await prisma.position.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
    positions[p.name] = pos.id;
  }
  console.log(`  ✅ ${positionsData.length} chức danh`);

  // ── 2. Đơn vị ────────────────────────────────────────────────────────────
  const rootUnit = await prisma.unit.upsert({
    where: { code: "CQ" },
    update: {},
    create: {
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
    const unit = await prisma.unit.upsert({
      where: { code: d.code },
      update: {},
      create: {
        ...d,
        parentId: rootUnit.id,
        level: 1,
      },
    });
    units[d.code] = unit.id;
  }
  console.log(`  ✅ ${departmentsData.length + 1} đơn vị`);

  // ── 3. Vai trò ────────────────────────────────────────────────────────────
  const rolesData = [
    {
      code: "ADMIN",
      name: "Quản trị hệ thống",
      description: "Quản trị hệ thống, không truy cập nội dung văn bản",
    },
    {
      code: "LEADER",
      name: "Lãnh đạo",
      description: "Bút phê, duyệt/ký văn bản đi",
    },
    {
      code: "DEPT_HEAD",
      name: "Trưởng phòng",
      description: "Duyệt sơ bộ, phân công, xác nhận hoàn thành",
    },
    {
      code: "CLERK",
      name: "Văn thư",
      description: "Vào sổ, cấp số, phát hành văn bản",
    },
    {
      code: "CITIZEN",
      name: "Người dân",
      description: "Nộp và theo dõi hồ sơ của mình",
    },
    {
      code: "SPECIALIST",
      name: "Chuyên viên",
      description: "Thụ lý văn bản, soạn dự thảo",
    },
  ];

  const roles: Record<string, string> = {};
  for (const r of rolesData) {
    const role = await prisma.role.upsert({
      where: { code: r.code },
      update: {},
      create: { ...r, isSystem: true },
    });
    roles[r.code] = role.id;
  }
  console.log(`  ✅ ${rolesData.length} vai trò`);

  // ── 4. Quyền (Permissions) ────────────────────────────────────────────────
  const permissionsData = [
    // Văn bản đến
    {
      code: "doc.incoming.view",
      name: "Xem văn bản đến",
      module: "doc.incoming",
    },
    {
      code: "doc.incoming.create",
      name: "Tiếp nhận văn bản đến",
      module: "doc.incoming",
    },
    {
      code: "doc.incoming.register",
      name: "Vào sổ văn bản đến",
      module: "doc.incoming",
    },
    {
      code: "doc.incoming.forward",
      name: "Trình văn bản đến",
      module: "doc.incoming",
    },
    {
      code: "doc.incoming.annotate",
      name: "Bút phê văn bản đến",
      module: "doc.incoming",
    },
    {
      code: "doc.incoming.assign",
      name: "Phân công xử lý",
      module: "doc.incoming",
    },
    {
      code: "doc.incoming.process",
      name: "Xử lý văn bản đến",
      module: "doc.incoming",
    },
    {
      code: "doc.incoming.complete",
      name: "Xác nhận hoàn thành",
      module: "doc.incoming",
    },
    // Văn bản đi
    {
      code: "doc.outgoing.view",
      name: "Xem văn bản đi",
      module: "doc.outgoing",
    },
    {
      code: "doc.outgoing.create",
      name: "Tạo dự thảo văn bản đi",
      module: "doc.outgoing",
    },
    {
      code: "doc.outgoing.review",
      name: "Duyệt sơ bộ văn bản đi",
      module: "doc.outgoing",
    },
    {
      code: "doc.outgoing.approve",
      name: "Duyệt/ký văn bản đi",
      module: "doc.outgoing",
    },
    {
      code: "doc.outgoing.sign",
      name: "Phê duyệt điện tử",
      module: "doc.outgoing",
    },
    {
      code: "doc.outgoing.number",
      name: "Cấp số văn bản đi",
      module: "doc.outgoing",
    },
    {
      code: "doc.outgoing.issue",
      name: "Ban hành văn bản đi",
      module: "doc.outgoing",
    },
    {
      code: "doc.outgoing.recall",
      name: "Thu hồi văn bản",
      module: "doc.outgoing",
    },
    {
      code: "doc.outgoing.replace",
      name: "Thay thế văn bản",
      module: "doc.outgoing",
    },
    {
      code: "doc.outgoing.cancel",
      name: "Hủy văn bản",
      module: "doc.outgoing",
    },
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
    {
      code: "archive.manage",
      name: "Quản lý hồ sơ lưu trữ",
      module: "archive",
    },
    // Thông báo
    {
      code: "notification.view",
      name: "Xem thông báo",
      module: "notification",
    },
  ];

  const perms: Record<string, string> = {};
  for (const p of permissionsData) {
    const perm = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
    perms[p.code] = perm.id;
  }
  console.log(`  ✅ ${permissionsData.length} quyền`);

  // ── 5. Gán quyền cho vai trò ──────────────────────────────────────────────
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
    ],
    LEADER: [
      "doc.incoming.view",
      "doc.incoming.create",
      "doc.incoming.annotate",
      "doc.incoming.forward",
      "doc.incoming.assign",
      "doc.incoming.process",
      "doc.incoming.complete",
      "doc.outgoing.view",
      "doc.outgoing.create",
      "doc.outgoing.review",
      "doc.outgoing.approve",
      "doc.outgoing.sign",
      "doc.outgoing.recall",
      "doc.outgoing.replace",
      "doc.outgoing.cancel",
      "catalog.view",
      "archive.view",
      "notification.view",
    ],
    DEPT_HEAD: [
      "doc.incoming.view",
      "doc.incoming.create",
      "doc.incoming.assign",
      "doc.incoming.complete",
      "doc.incoming.process",
      "doc.outgoing.view",
      "doc.outgoing.create",
      "doc.outgoing.review",
      "catalog.view",
      "notification.view",
    ],
    CLERK: [
      "doc.incoming.view",
      "doc.incoming.create",
      "doc.incoming.register",
      "doc.incoming.forward",
      "doc.incoming.complete",
      "doc.outgoing.view",
      "doc.outgoing.create",
      "doc.outgoing.number",
      "doc.outgoing.issue",
      "catalog.view",
      "archive.view",
      "archive.manage",
      "notification.view",
    ],
    CITIZEN: ["notification.view"],
    SPECIALIST: [
      "doc.incoming.view",
      "doc.incoming.create",
      "doc.incoming.register",
      "doc.incoming.forward",
      "doc.incoming.assign",
      "doc.incoming.process",
      "doc.outgoing.view",
      "doc.outgoing.create",
      "catalog.view",
      "notification.view",
      "archive.view",
      "archive.manage",
    ],
  };

  let rpCount = 0;
  for (const [roleCode, permCodes] of Object.entries(rolePermissionMap)) {
    for (const permCode of permCodes) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles[roleCode],
            permissionId: perms[permCode],
          },
        },
        update: {},
        create: {
          roleId: roles[roleCode],
          permissionId: perms[permCode],
        },
      });
      rpCount++;
    }
  }
  console.log(`  ✅ ${rpCount} gán quyền cho vai trò`);

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
    const docType = await prisma.documentType.upsert({
      where: { code: dt.code },
      update: {},
      create: dt,
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
    await prisma.field.upsert({
      where: { code: f.code },
      update: {},
      create: f,
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
    await prisma.externalOrganization.upsert({
      where: { code: org.code },
      update: {},
      create: org,
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
  ];

  for (const b of booksData) {
    const book = await prisma.documentBook.upsert({
      where: { code: b.code },
      update: {},
      create: b,
    });

    // Tạo bộ đếm cho năm hiện tại
    const currentYear = new Date().getFullYear();
    await prisma.documentBookCounter.upsert({
      where: {
        bookId_year: { bookId: book.id, year: currentYear },
      },
      update: {},
      create: {
        bookId: book.id,
        year: currentYear,
        lastNumber: 0,
      },
    });
  }
  console.log(`  ✅ ${booksData.length} sổ văn bản`);

  // ── 10. Tài khoản Admin mặc định ──────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@eoffice.local" },
    update: {},
    create: {
      employeeCode: "ADMIN001",
      fullName: "Quản trị viên",
      email: "admin@eoffice.local",
      passwordHash: hashPassword("Admin@123"),
      isActive: true,
    },
  });

  // Gán admin vào đơn vị gốc, chức danh Quản trị hệ thống
  const adminPosition = await prisma.userPosition.upsert({
    where: {
      userId_unitId_positionId_startedAt: {
        userId: adminUser.id,
        unitId: rootUnit.id,
        positionId: positions["Quản trị hệ thống"],
        startedAt: new Date("2024-01-01"),
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      unitId: rootUnit.id,
      positionId: positions["Quản trị hệ thống"],
      isPrimary: true,
      startedAt: new Date("2024-01-01"),
    },
  });

  // Gán vai trò ADMIN
  await prisma.userPositionRole.upsert({
    where: {
      userPositionId_roleId: {
        userPositionId: adminPosition.id,
        roleId: roles["ADMIN"],
      },
    },
    update: {},
    create: {
      userPositionId: adminPosition.id,
      roleId: roles["ADMIN"],
      dataScope: DataScope.ALL,
    },
  });

  // ── 11. Tài khoản demo (để test luồng) ────────────────────────────────────
  const demoUsers = [
    {
      employeeCode: "CD001",
      fullName: "Nguyễn Văn Dân",
      email: "nguoidan@eoffice.local",
      positionName: "Chuyên viên",
      unitCode: "CQ",
      roleCode: "CITIZEN",
      dataScope: DataScope.OWN,
    },
    {
      employeeCode: "GD001",
      fullName: "Nguyễn Văn An",
      email: "giamdoc@eoffice.local",
      positionName: "Lãnh đạo",
      unitCode: "CQ",
      roleCode: "LEADER",
      dataScope: DataScope.ALL,
    },
    {
      employeeCode: "TP001",
      fullName: "Trần Thị Bình",
      email: "truongphong.tchc@eoffice.local",
      positionName: "Lãnh đạo",
      unitCode: "TCHC",
      roleCode: "LEADER",
      dataScope: DataScope.UNIT_TREE,
    },
    {
      employeeCode: "VT001",
      fullName: "Lê Văn Cường",
      email: "vanthu@eoffice.local",
      positionName: "Văn thư",
      unitCode: "VP",
      roleCode: "CLERK",
      dataScope: DataScope.ALL,
    },
    {
      employeeCode: "CV001",
      fullName: "Phạm Thị Dung",
      email: "chuyenvien.tchc@eoffice.local",
      positionName: "Chuyên viên",
      unitCode: "TCHC",
      roleCode: "SPECIALIST",
      dataScope: DataScope.OWN,
    },
  ];

  for (const du of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: du.email },
      update: {},
      create: {
        employeeCode: du.employeeCode,
        fullName: du.fullName,
        email: du.email,
        passwordHash: hashPassword("Demo@123"),
        isActive: true,
      },
    });

    const up = await prisma.userPosition.upsert({
      where: {
        userId_unitId_positionId_startedAt: {
          userId: user.id,
          unitId: units[du.unitCode],
          positionId: positions[du.positionName],
          startedAt: new Date("2024-01-01"),
        },
      },
      update: {},
      create: {
        userId: user.id,
        unitId: units[du.unitCode],
        positionId: positions[du.positionName],
        isPrimary: true,
        startedAt: new Date("2024-01-01"),
      },
    });

    await prisma.userPositionRole.upsert({
      where: {
        userPositionId_roleId: {
          userPositionId: up.id,
          roleId: roles[du.roleCode],
        },
      },
      update: {},
      create: {
        userPositionId: up.id,
        roleId: roles[du.roleCode],
        dataScope: du.dataScope,
      },
    });
  }
  console.log(`  ✅ ${demoUsers.length + 1} tài khoản (admin + demo)`);

  console.log("\n🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
