// src/lib/demo-data.ts
// Dữ liệu mẫu Demo khi hệ thống chưa kết nối cơ sở dữ liệu PostgreSQL cục bộ

import { DataScope, DocumentStatus, UrgencyLevel, SecurityLevel } from "@prisma/client";

export interface DemoAuthContext {
  userId: string;
  roles: Array<{ id: string; code: string; name: string; dataScope: DataScope }>;
  roleCodes: string[];
  permissions: string[];
  maxDataScope: DataScope;
  primaryPosition: {
    positionId: string;
    positionName: string;
    unitId: string;
    unitName: string;
    unitCode: string;
  };
  userPositions: Array<{
    positionId: string;
    positionName: string;
    unitId: string;
    unitName: string;
    unitCode: string;
    isPrimary: boolean;
  }>;
}

export interface DemoUserDef {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  positionName: string;
  unitName: string;
  unitCode: string;
  roleCode: "ADMIN" | "LEADER" | "DEPT_HEAD" | "CLERK" | "SPECIALIST" | "CITIZEN";
  dataScope: DataScope;
}

export const DEMO_USERS: Record<string, DemoUserDef> = {
  "admin@eoffice.local": {
    id: "usr-demo-admin",
    employeeCode: "ADMIN001",
    fullName: "Quản trị viên Hệ thống",
    email: "admin@eoffice.local",
    positionName: "Quản trị viên",
    unitName: "Cơ quan hành chính",
    unitCode: "CQ",
    roleCode: "ADMIN",
    dataScope: "ALL",
  },
  "giamdoc@eoffice.local": {
    id: "usr-demo-leader",
    employeeCode: "GD001",
    fullName: "Nguyễn Văn An",
    email: "giamdoc@eoffice.local",
    positionName: "Giám đốc",
    unitName: "Cơ quan hành chính",
    unitCode: "CQ",
    roleCode: "LEADER",
    dataScope: "ALL",
  },
  "truongphong.tchc@eoffice.local": {
    id: "usr-demo-depthead",
    employeeCode: "TP001",
    fullName: "Trần Thị Bình",
    email: "truongphong.tchc@eoffice.local",
    positionName: "Trưởng phòng TCHC",
    unitName: "Phòng Tổ chức - Hành chính",
    unitCode: "TCHC",
    roleCode: "DEPT_HEAD",
    dataScope: "UNIT_TREE",
  },
  "vanthu@eoffice.local": {
    id: "usr-demo-clerk",
    employeeCode: "VT001",
    fullName: "Lê Văn Cường",
    email: "vanthu@eoffice.local",
    positionName: "Văn thư cơ quan",
    unitName: "Văn phòng cơ quan",
    unitCode: "VP",
    roleCode: "CLERK",
    dataScope: "ALL",
  },
  "chuyenvien.tchc@eoffice.local": {
    id: "usr-demo-specialist",
    employeeCode: "CV001",
    fullName: "Phạm Minh Đức",
    email: "chuyenvien.tchc@eoffice.local",
    positionName: "Chuyên viên TCHC",
    unitName: "Phòng Tổ chức - Hành chính",
    unitCode: "TCHC",
    roleCode: "SPECIALIST",
    dataScope: "OWN",
  },
  "nguoidan@eoffice.local": {
    id: "usr-demo-citizen",
    employeeCode: "CD001",
    fullName: "Nguyễn Văn Dân",
    email: "nguoidan@eoffice.local",
    positionName: "Người dân / Đại diện Doanh nghiệp",
    unitName: "Cổng tiếp nhận trực tuyến",
    unitCode: "CITIZEN",
    roleCode: "CITIZEN",
    dataScope: "OWN",
  },
};

export function getDemoAuthContext(userDef: DemoUserDef): DemoAuthContext {
  const allPermissions = [
    "doc.incoming.view", "doc.incoming.create", "doc.incoming.register", "doc.incoming.annotate",
    "doc.incoming.assign", "doc.incoming.forward", "doc.incoming.report", "doc.incoming.complete",
    "doc.outgoing.view", "doc.outgoing.create", "doc.outgoing.review", "doc.outgoing.approve",
    "doc.outgoing.sign", "doc.outgoing.number", "doc.outgoing.issue", "doc.outgoing.recall",
    "doc.outgoing.replace", "doc.outgoing.cancel", "catalog.view", "catalog.manage",
    "admin.user.manage", "admin.role.manage", "admin.unit.manage", "admin.system",
    "archive.view", "archive.manage", "notification.view",
  ];

  const rolePermissions: Record<string, string[]> = {
    ADMIN: allPermissions,
    LEADER: [
      "doc.incoming.view", "doc.incoming.create", "doc.incoming.annotate", "doc.incoming.forward", "doc.incoming.assign", "doc.incoming.complete",
      "doc.outgoing.view", "doc.outgoing.create", "doc.outgoing.review", "doc.outgoing.approve", "doc.outgoing.sign",
      "doc.outgoing.recall", "doc.outgoing.replace", "doc.outgoing.cancel",
      "catalog.view", "notification.view", "archive.view",
    ],
    DEPT_HEAD: [
      "doc.incoming.view", "doc.incoming.create", "doc.incoming.assign", "doc.incoming.forward", "doc.incoming.complete",
      "doc.outgoing.view", "doc.outgoing.create", "doc.outgoing.review", "doc.outgoing.approve",
      "catalog.view", "notification.view", "archive.view",
    ],
    CLERK: [
      "doc.incoming.view", "doc.incoming.create", "doc.incoming.register", "doc.incoming.forward", "doc.incoming.assign",
      "doc.outgoing.view", "doc.outgoing.create", "doc.outgoing.number", "doc.outgoing.issue",
      "catalog.view", "notification.view", "archive.view",
    ],
    SPECIALIST: [
      "doc.incoming.view", "doc.incoming.report", "doc.incoming.process",
      "doc.outgoing.view", "doc.outgoing.create",
      "notification.view", "archive.view",
    ],
    CITIZEN: [
      "doc.incoming.view", "doc.incoming.create",
      "notification.view",
    ],
  };

  return {
    userId: userDef.id,
    roles: [
      {
        id: `role-${userDef.roleCode.toLowerCase()}`,
        code: userDef.roleCode,
        name: userDef.roleCode,
        dataScope: userDef.dataScope,
      },
    ],
    roleCodes: [userDef.roleCode],
    permissions: rolePermissions[userDef.roleCode] || [],
    maxDataScope: userDef.dataScope,
    primaryPosition: {
      positionId: `pos-${userDef.id}`,
      positionName: userDef.positionName,
      unitId: `unit-${userDef.unitCode.toLowerCase()}`,
      unitName: userDef.unitName,
      unitCode: userDef.unitCode,
    },
    userPositions: [
      {
        positionId: `pos-${userDef.id}`,
        positionName: userDef.positionName,
        unitId: `unit-${userDef.unitCode.toLowerCase()}`,
        unitName: userDef.unitName,
        unitCode: userDef.unitCode,
        isPrimary: true,
      },
    ],
  };
}

export const DEMO_DOCUMENTS = [
  // ══════════════════════════════════════════════════════════════════════════
  // 5 VĂN BẢN ĐẾN (INCOMING) - CHUẨN NGHỊ ĐỊNH 30/2020/NĐ-CP
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "doc-demo-01",
    documentType: "INCOMING",
    direction: "INCOMING",
    title: "V/v Hướng dẫn triển khai công tác cải cách hành chính và chuyển đổi số năm 2026",
    documentNumber: "128",
    documentNumberYear: 2026,
    documentOrder: 128,
    originalCode: "452/BNV-CCHC",
    senderName: "Bộ Nội vụ",
    senderOrg: { id: "org-bnv", name: "Bộ Nội vụ", code: "BNV", address: "Số 8 Tôn Thất Thuyết, Hà Nội", phone: "024.3768.4567" },
    issuedDate: new Date("2026-02-15").toISOString(),
    receivedDate: new Date("2026-02-16").toISOString(),
    processingDeadline: new Date("2026-03-01").toISOString(),
    status: "PROCESSING" as DocumentStatus,
    urgency: "URGENT" as UrgencyLevel,
    security: "NORMAL" as SecurityLevel,
    isArchived: false,
    documentBook: { id: "book-den", name: "Sổ văn bản đến chung", code: "SVB-DEN" },
    docType: { id: "type-cv", name: "Công văn", code: "CV" },
    documentTypeDetail: { id: "type-cv", name: "Công văn", code: "CV" },
    draftUnit: { id: "unit-tchc", name: "Phòng Tổ chức - Hành chính", code: "TCHC" },
    creator: { id: "usr-demo-clerk", fullName: "Lê Văn Cường", employeeCode: "VT001" },
    handlers: [
      {
        id: "hdl-01",
        role: "MAIN",
        status: "PROCESSING",
        instruction: "Chủ trì tổng hợp kế hoạch thực hiện trước ngày 28/02",
        assignee: { id: "usr-demo-specialist", fullName: "Phạm Minh Đức", email: "chuyenvien.tchc@eoffice.local", employeeCode: "CV001" },
        deadline: new Date("2026-02-28").toISOString(),
      },
    ],
    files: [
      {
        id: "file-01",
        fileName: "Huong-dan-cai-cach-hanh-chinh-2026.pdf",
        fileSize: 1248576,
        mimeType: "application/pdf",
        isCurrent: true,
        version: 1,
      },
    ],
    timeline: [
      {
        id: "log-01",
        action: "VÀO SỔ TIẾP NHẬN",
        actor: { fullName: "Lê Văn Cường" },
        createdAt: new Date("2026-02-16T08:30:00").toISOString(),
        description: "Tiếp nhận văn bản đến và vào sổ tiếp nhận số 128/2026",
      },
      {
        id: "log-02",
        action: "LÃNH ĐẠO CHO Ý KIẾN",
        actor: { fullName: "Nguyễn Văn An" },
        createdAt: new Date("2026-02-16T10:00:00").toISOString(),
        description: "Chuyển Phòng TCHC chủ trì triển khai theo đúng hướng dẫn của Bộ Nội vụ",
      },
      {
        id: "log-03",
        action: "PHÂN CÔNG CHỦ TRÌ",
        actor: { fullName: "Trần Thị Bình" },
        createdAt: new Date("2026-02-16T14:15:00").toISOString(),
        description: "Giao đồng chí Phạm Minh Đức thụ lý chính, xây dựng kế hoạch chi tiết",
      },
    ],
  },
  {
    id: "doc-demo-02",
    documentType: "INCOMING",
    direction: "INCOMING",
    title: "Triệu tập Hội nghị sơ kết công tác quý I và triển khai nhiệm vụ quý II năm 2026",
    documentNumber: "86",
    documentNumberYear: 2026,
    documentOrder: 86,
    originalCode: "12/GM-UBND",
    senderName: "Ủy ban nhân dân Tỉnh",
    senderOrg: { id: "org-ubnd", name: "Ủy ban nhân dân Tỉnh", code: "UBND", address: "Số 1 Hoàng Diệu", phone: "020.3822.123" },
    issuedDate: new Date("2026-02-20").toISOString(),
    receivedDate: new Date("2026-02-21").toISOString(),
    processingDeadline: new Date("2026-02-25").toISOString(),
    status: "PENDING_LEADER" as DocumentStatus,
    urgency: "FIRE" as UrgencyLevel,
    security: "NORMAL" as SecurityLevel,
    isArchived: false,
    documentBook: { id: "book-den", name: "Sổ văn bản đến chung", code: "SVB-DEN" },
    docType: { id: "type-gm", name: "Giấy mời", code: "GM" },
    documentTypeDetail: { id: "type-gm", name: "Giấy mời", code: "GM" },
    draftUnit: { id: "unit-vp", name: "Văn phòng cơ quan", code: "VP" },
    creator: { id: "usr-demo-clerk", fullName: "Lê Văn Cường", employeeCode: "VT001" },
    handlers: [],
    files: [
      {
        id: "file-02",
        fileName: "Giay-moi-so-ket-quy-1.pdf",
        fileSize: 524288,
        mimeType: "application/pdf",
        isCurrent: true,
        version: 1,
      },
    ],
    timeline: [
      {
        id: "log-21",
        action: "TIẾP NHẬN HỎA TỐC",
        actor: { fullName: "Lê Văn Cường" },
        createdAt: new Date("2026-02-21T07:45:00").toISOString(),
        description: "Tiếp nhận giấy mời hỏa tốc vào sổ số 86/2026, trình Giám đốc cho ý kiến",
      },
    ],
  },
  {
    id: "doc-demo-05",
    documentType: "INCOMING",
    direction: "INCOMING",
    title: "Quyết định phê duyệt danh mục vị trí việc làm và cơ cấu ngạch công chức năm 2026",
    documentNumber: "145",
    documentNumberYear: 2026,
    documentOrder: 145,
    originalCode: "78/QĐ-SNV",
    senderName: "Sở Nội vụ",
    senderOrg: { id: "org-snv", name: "Sở Nội vụ", code: "SNV", address: "Số 45 Trần Hưng Đạo", phone: "020.3831.555" },
    issuedDate: new Date("2026-02-10").toISOString(),
    receivedDate: new Date("2026-02-12").toISOString(),
    processingDeadline: new Date("2026-02-20").toISOString(),
    status: "COMPLETED" as DocumentStatus,
    urgency: "NORMAL" as UrgencyLevel,
    security: "NORMAL" as SecurityLevel,
    isArchived: true,
    documentBook: { id: "book-den", name: "Sổ văn bản đến chung", code: "SVB-DEN" },
    docType: { id: "type-qd", name: "Quyết định", code: "QĐ" },
    documentTypeDetail: { id: "type-qd", name: "Quyết định", code: "QĐ" },
    draftUnit: { id: "unit-tchc", name: "Phòng Tổ chức - Hành chính", code: "TCHC" },
    creator: { id: "usr-demo-clerk", fullName: "Lê Văn Cường", employeeCode: "VT001" },
    handlers: [
      {
        id: "hdl-05",
        role: "MAIN",
        status: "COMPLETED",
        instruction: "Cập nhật hồ sơ vị trí việc làm toàn cơ quan theo quyết định",
        assignee: { id: "usr-demo-depthead", fullName: "Trần Thị Bình", email: "truongphong.tchc@eoffice.local", employeeCode: "TP001" },
        deadline: new Date("2026-02-20").toISOString(),
      },
    ],
    files: [
      {
        id: "file-05",
        fileName: "Quyet-dinh-vi-tri-viec-lam.pdf",
        fileSize: 843200,
        mimeType: "application/pdf",
        isCurrent: true,
        version: 1,
      },
    ],
    timeline: [
      {
        id: "log-51",
        action: "VÀO SỔ TIẾP NHẬN",
        actor: { fullName: "Lê Văn Cường" },
        createdAt: new Date("2026-02-12T09:00:00").toISOString(),
        description: "Vào sổ văn bản đến số 145/2026",
      },
      {
        id: "log-52",
        action: "HOÀN THÀNH XỬ LÝ",
        actor: { fullName: "Trần Thị Bình" },
        createdAt: new Date("2026-02-19T16:30:00").toISOString(),
        description: "Đã rà soát và lưu trữ vào hồ sơ vị trí việc làm cơ quan",
      },
    ],
  },
  {
    id: "doc-demo-06",
    documentType: "INCOMING",
    direction: "INCOMING",
    title: "V/v Thẩm định dự toán mua sắm trang thiết bị CNTT phục vụ số hóa tài liệu lưu trữ",
    documentNumber: "152",
    documentNumberYear: 2026,
    documentOrder: 152,
    originalCode: "301/STC-HCSN",
    senderName: "Sở Tài chính",
    senderOrg: { id: "org-stc", name: "Sở Tài chính", code: "STC", address: "Số 12 Lê Lợi", phone: "020.3842.888" },
    issuedDate: new Date("2026-02-22").toISOString(),
    receivedDate: new Date("2026-02-23").toISOString(),
    processingDeadline: new Date("2026-03-05").toISOString(),
    status: "DISTRIBUTED" as DocumentStatus,
    urgency: "URGENT" as UrgencyLevel,
    security: "NORMAL" as SecurityLevel,
    isArchived: false,
    documentBook: { id: "book-den", name: "Sổ văn bản đến chung", code: "SVB-DEN" },
    docType: { id: "type-cv", name: "Công văn", code: "CV" },
    documentTypeDetail: { id: "type-cv", name: "Công văn", code: "CV" },
    draftUnit: { id: "unit-tchc", name: "Phòng Tổ chức - Hành chính", code: "TCHC" },
    creator: { id: "usr-demo-clerk", fullName: "Lê Văn Cường", employeeCode: "VT001" },
    handlers: [
      {
        id: "hdl-06",
        role: "MAIN",
        status: "ASSIGNED",
        instruction: "Phòng TCHC phối hợp KHTC hoàn thiện hồ sơ dự toán",
        assignee: { id: "usr-demo-depthead", fullName: "Trần Thị Bình", email: "truongphong.tchc@eoffice.local", employeeCode: "TP001" },
        deadline: new Date("2026-03-05").toISOString(),
      },
    ],
    files: [
      {
        id: "file-06",
        fileName: "Cong-van-301-STC-du-toan-CNTT.pdf",
        fileSize: 962560,
        mimeType: "application/pdf",
        isCurrent: true,
        version: 1,
      },
    ],
    timeline: [
      {
        id: "log-61",
        action: "VÀO SỔ TIẾP NHẬN",
        actor: { fullName: "Lê Văn Cường" },
        createdAt: new Date("2026-02-23T08:15:00").toISOString(),
        description: "Tiếp nhận văn bản đến số 152/2026",
      },
      {
        id: "log-62",
        action: "BÚT PHÊ LÃNH ĐẠO",
        actor: { fullName: "Nguyễn Văn An" },
        createdAt: new Date("2026-02-23T11:00:00").toISOString(),
        description: "Giao Phòng TCHC chủ trì, Phòng KHTC phối hợp hoàn chỉnh dự toán trước 05/03",
      },
    ],
  },
  {
    id: "doc-demo-07",
    documentType: "INCOMING",
    direction: "INCOMING",
    title: "Thông báo kết luận của Chủ tịch UBND Tỉnh tại phiên họp thường kỳ tháng 2/2026",
    documentNumber: "160",
    documentNumberYear: 2026,
    documentOrder: 160,
    originalCode: "55/TB-VP",
    senderName: "Văn phòng UBND Tỉnh",
    senderOrg: { id: "org-vp-ubnd", name: "Văn phòng UBND Tỉnh", code: "VP-UBND", address: "Số 1 Hoàng Diệu", phone: "020.3822.124" },
    issuedDate: new Date("2026-02-24").toISOString(),
    receivedDate: new Date("2026-02-24").toISOString(),
    processingDeadline: new Date("2026-02-28").toISOString(),
    status: "RECEIVED" as DocumentStatus,
    urgency: "NORMAL" as UrgencyLevel,
    security: "NORMAL" as SecurityLevel,
    isArchived: false,
    documentBook: { id: "book-den", name: "Sổ văn bản đến chung", code: "SVB-DEN" },
    docType: { id: "type-tb", name: "Thông báo", code: "TB" },
    documentTypeDetail: { id: "type-tb", name: "Thông báo", code: "TB" },
    draftUnit: { id: "unit-vp", name: "Văn phòng cơ quan", code: "VP" },
    creator: { id: "usr-demo-clerk", fullName: "Lê Văn Cường", employeeCode: "VT001" },
    handlers: [],
    files: [
      {
        id: "file-07",
        fileName: "Thong-bao-ket-luan-hop-thang-2.pdf",
        fileSize: 485120,
        mimeType: "application/pdf",
        isCurrent: true,
        version: 1,
      },
    ],
    timeline: [
      {
        id: "log-71",
        action: "VÀO SỔ TIẾP NHẬN",
        actor: { fullName: "Lê Văn Cường" },
        createdAt: new Date("2026-02-24T14:30:00").toISOString(),
        description: "Văn thư tiếp nhận vào sổ số 160/2026, chuẩn bị trình Giám đốc cho ý kiến",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 5 VĂN BẢN ĐI (OUTGOING) - CHUẨN NGHỊ ĐỊNH 30/2020/NĐ-CP
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "doc-demo-03",
    documentType: "OUTGOING",
    direction: "OUTGOING",
    title: "Quyết định về việc kiện toàn Hội đồng Thi đua - Khen thưởng cơ quan",
    documentNumber: "45/QĐ-CQ",
    documentNumberYear: 2026,
    documentOrder: 45,
    issuedDate: new Date("2026-02-18").toISOString(),
    receivedDate: new Date("2026-02-18").toISOString(),
    status: "ISSUED" as DocumentStatus,
    urgency: "NORMAL" as UrgencyLevel,
    security: "NORMAL" as SecurityLevel,
    isArchived: false,
    signerName: "Nguyễn Văn An",
    signerPosition: "Giám đốc",
    draftUnit: { id: "unit-tchc", name: "Phòng Tổ chức - Hành chính", code: "TCHC" },
    creator: { id: "usr-demo-depthead", fullName: "Trần Thị Bình", employeeCode: "TP001" },
    documentBook: { id: "book-qd", name: "Sổ Quyết định", code: "SQD" },
    docType: { id: "type-qd", name: "Quyết định", code: "QĐ" },
    documentTypeDetail: { id: "type-qd", name: "Quyết định", code: "QĐ" },
    recipientsSummary: "Các phòng ban, đơn vị trực thuộc cơ quan",
    handlers: [],
    approvals: [
      { stepOrder: 1, role: "REVIEWER", status: "APPROVED", approver: { fullName: "Trần Thị Bình" } },
      { stepOrder: 2, role: "SIGNER", status: "SIGNED", approver: { fullName: "Nguyễn Văn An" } },
      { stepOrder: 3, role: "CLERK", status: "ISSUED", approver: { fullName: "Lê Văn Cường" } },
    ],
    files: [
      {
        id: "file-03",
        fileName: "Quyet-dinh-thi-dua-khen-thuong.pdf",
        fileSize: 819200,
        mimeType: "application/pdf",
        isCurrent: true,
        version: 1,
      },
    ],
    timeline: [
      {
        id: "log-30",
        action: "KHỞI TẠO DỰ THẢO",
        actor: { fullName: "Trần Thị Bình" },
        createdAt: new Date("2026-02-17T09:00:00").toISOString(),
        description: "Khởi tạo dự thảo Quyết định kiện toàn Hội đồng Thi đua - Khen thưởng",
      },
      {
        id: "log-31",
        action: "KÝ SỐ ĐIỆN TỬ",
        actor: { fullName: "Nguyễn Văn An" },
        createdAt: new Date("2026-02-18T14:30:00").toISOString(),
        description: "Giám đốc đã ký duyệt và ký số chứng thư cơ quan",
      },
      {
        id: "log-32",
        action: "BAN HÀNH CHÍNH THỨC",
        actor: { fullName: "Lê Văn Cường" },
        createdAt: new Date("2026-02-18T16:00:00").toISOString(),
        description: "Đã cấp số 45/QĐ-CQ, đóng dấu phát hành điện tử và khóa tệp",
      },
    ],
    createdAt: new Date("2026-02-17T09:00:00").toISOString(),
  },
  {
    id: "doc-demo-08",
    documentType: "OUTGOING",
    direction: "OUTGOING",
    title: "Báo cáo tình hình triển khai chuyển đổi số và an toàn thông tin quý I/2026",
    documentNumber: "142/CV-TCHC",
    documentNumberYear: 2026,
    documentOrder: 142,
    issuedDate: new Date("2026-02-23").toISOString(),
    receivedDate: new Date("2026-02-23").toISOString(),
    status: "NUMBERED" as DocumentStatus,
    urgency: "URGENT" as UrgencyLevel,
    security: "NORMAL" as SecurityLevel,
    isArchived: false,
    signerName: "Nguyễn Văn An",
    signerPosition: "Giám đốc",
    draftUnit: { id: "unit-tchc", name: "Phòng Tổ chức - Hành chính", code: "TCHC" },
    creator: { id: "usr-demo-specialist", fullName: "Phạm Minh Đức", employeeCode: "CV001" },
    documentBook: { id: "book-cv", name: "Sổ Công văn đi", code: "SCV" },
    docType: { id: "type-cv", name: "Công văn", code: "CV" },
    documentTypeDetail: { id: "type-cv", name: "Công văn", code: "CV" },
    recipientsSummary: "Sở Thông tin và Truyền thông, UBND Tỉnh",
    handlers: [],
    approvals: [
      { stepOrder: 1, role: "REVIEWER", status: "APPROVED", approver: { fullName: "Trần Thị Bình" } },
      { stepOrder: 2, role: "SIGNER", status: "SIGNED", approver: { fullName: "Nguyễn Văn An" } },
      { stepOrder: 3, role: "CLERK", status: "NUMBERED", approver: { fullName: "Lê Văn Cường" } },
    ],
    files: [
      {
        id: "file-08",
        fileName: "Bao-cao-chuyen-doi-so-Q1.pdf",
        fileSize: 1450000,
        mimeType: "application/pdf",
        isCurrent: true,
        version: 1,
      },
    ],
    timeline: [
      {
        id: "log-81",
        action: "TRƯỞNG PHÒNG DUYỆT",
        actor: { fullName: "Trần Thị Bình" },
        createdAt: new Date("2026-02-22T10:00:00").toISOString(),
        description: "Duyệt thông qua nội dung báo cáo, chuyển Giám đốc ký",
      },
      {
        id: "log-82",
        action: "ĐÃ CẤP SỐ VĂN BẢN",
        actor: { fullName: "Lê Văn Cường" },
        createdAt: new Date("2026-02-23T15:20:00").toISOString(),
        description: "Văn thư cấp số 142/CV-TCHC, chờ phát hành trên trục liên thông",
      },
    ],
    createdAt: new Date("2026-02-21T08:30:00").toISOString(),
  },
  {
    id: "doc-demo-04",
    documentType: "OUTGOING",
    direction: "OUTGOING",
    title: "Tờ trình về việc phê duyệt dự toán kinh phí nâng cấp hạ tầng CNTT năm 2026",
    documentNumber: "DRAFT-2026-09",
    documentNumberYear: 2026,
    documentOrder: 9,
    issuedDate: new Date("2026-02-22").toISOString(),
    receivedDate: new Date("2026-02-22").toISOString(),
    status: "PENDING_APPROVAL" as DocumentStatus,
    urgency: "URGENT" as UrgencyLevel,
    security: "NORMAL" as SecurityLevel,
    isArchived: false,
    signerName: "Nguyễn Văn An",
    signerPosition: "Giám đốc",
    draftUnit: { id: "unit-tchc", name: "Phòng Tổ chức - Hành chính", code: "TCHC" },
    creator: { id: "usr-demo-specialist", fullName: "Phạm Minh Đức", employeeCode: "CV001" },
    documentBook: { id: "book-ttr", name: "Sổ Công văn đi - TCHC", code: "SCV-TCHC" },
    docType: { id: "type-ttr", name: "Tờ trình", code: "TTr" },
    documentTypeDetail: { id: "type-ttr", name: "Tờ trình", code: "TTr" },
    recipientsSummary: "Ban Giám đốc cơ quan",
    handlers: [],
    approvals: [
      { stepOrder: 1, role: "REVIEWER", status: "APPROVED", approver: { fullName: "Trần Thị Bình" } },
      { stepOrder: 2, role: "SIGNER", status: "PENDING", approver: { fullName: "Nguyễn Văn An" } },
    ],
    files: [
      {
        id: "file-04",
        fileName: "To-trinh-kinh-phi-CNTT.docx",
        fileSize: 614400,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        isCurrent: true,
        version: 1,
      },
    ],
    timeline: [
      {
        id: "log-41",
        action: "TRÌNH LÃNH ĐẠO DUYỆT",
        actor: { fullName: "Trần Thị Bình" },
        createdAt: new Date("2026-02-22T09:30:00").toISOString(),
        description: "Trưởng phòng TCHC đã duyệt sơ bộ, kính trình Giám đốc xem xét ký phê duyệt",
      },
    ],
    createdAt: new Date("2026-02-21T14:00:00").toISOString(),
  },
  {
    id: "doc-demo-09",
    documentType: "OUTGOING",
    direction: "OUTGOING",
    title: "Kế hoạch tổ chức tập huấn công tác văn thư lưu trữ và lập hồ sơ công việc điện tử",
    documentNumber: "DRAFT-2026-11",
    documentNumberYear: 2026,
    documentOrder: 11,
    issuedDate: new Date("2026-02-24").toISOString(),
    receivedDate: new Date("2026-02-24").toISOString(),
    status: "PENDING_REVIEW" as DocumentStatus,
    urgency: "NORMAL" as UrgencyLevel,
    security: "NORMAL" as SecurityLevel,
    isArchived: false,
    signerName: "Nguyễn Văn An",
    signerPosition: "Giám đốc",
    draftUnit: { id: "unit-vp", name: "Văn phòng cơ quan", code: "VP" },
    creator: { id: "usr-demo-clerk", fullName: "Lê Văn Cường", employeeCode: "VT001" },
    documentBook: { id: "book-kh", name: "Sổ Kế hoạch", code: "SKH" },
    docType: { id: "type-kh", name: "Kế hoạch", code: "KH" },
    documentTypeDetail: { id: "type-kh", name: "Kế hoạch", code: "KH" },
    recipientsSummary: "Toàn thể cán bộ, công chức, viên chức",
    handlers: [],
    approvals: [
      { stepOrder: 1, role: "REVIEWER", status: "PENDING", approver: { fullName: "Trần Thị Bình" } },
      { stepOrder: 2, role: "SIGNER", status: "PENDING", approver: { fullName: "Nguyễn Văn An" } },
    ],
    files: [
      {
        id: "file-09",
        fileName: "Ke-hoach-tap-huan-van-thu.docx",
        fileSize: 450000,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        isCurrent: true,
        version: 1,
      },
    ],
    timeline: [
      {
        id: "log-91",
        action: "KHỞI TẠO DỰ THẢO",
        actor: { fullName: "Lê Văn Cường" },
        createdAt: new Date("2026-02-24T10:15:00").toISOString(),
        description: "Khởi tạo dự thảo kế hoạch tập huấn, chuyển Trưởng phòng kiểm tra sơ bộ",
      },
    ],
    createdAt: new Date("2026-02-24T10:15:00").toISOString(),
  },
  {
    id: "doc-demo-10",
    documentType: "OUTGOING",
    direction: "OUTGOING",
    title: "Thông báo lịch trực cơ quan và đảm bảo an ninh trật tự dịp nghỉ lễ",
    documentNumber: "DRAFT-2026-15",
    documentNumberYear: 2026,
    documentOrder: 15,
    issuedDate: new Date("2026-02-25").toISOString(),
    receivedDate: new Date("2026-02-25").toISOString(),
    status: "DRAFT" as DocumentStatus,
    urgency: "NORMAL" as UrgencyLevel,
    security: "NORMAL" as SecurityLevel,
    isArchived: false,
    signerName: "Nguyễn Văn An",
    signerPosition: "Giám đốc",
    draftUnit: { id: "unit-tchc", name: "Phòng Tổ chức - Hành chính", code: "TCHC" },
    creator: { id: "usr-demo-specialist", fullName: "Phạm Minh Đức", employeeCode: "CV001" },
    documentBook: { id: "book-tb", name: "Sổ Thông báo", code: "STB" },
    docType: { id: "type-tb", name: "Thông báo", code: "TB" },
    documentTypeDetail: { id: "type-tb", name: "Thông báo", code: "TB" },
    recipientsSummary: "Toàn thể cán bộ, nhân viên cơ quan",
    handlers: [],
    approvals: [],
    files: [
      {
        id: "file-10",
        fileName: "Du-thao-thong-bao-lich-truc.docx",
        fileSize: 320000,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        isCurrent: true,
        version: 1,
      },
    ],
    timeline: [
      {
        id: "log-101",
        action: "TẠO BẢN THẢO",
        actor: { fullName: "Phạm Minh Đức" },
        createdAt: new Date("2026-02-25T08:30:00").toISOString(),
        description: "Chuyên viên đang soạn thảo và hoàn thiện danh sách phân công trực",
      },
    ],
    createdAt: new Date("2026-02-25T08:30:00").toISOString(),
  },
];
