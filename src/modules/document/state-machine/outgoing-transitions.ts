// src/modules/document/state-machine/outgoing-transitions.ts
// Bảng cấu hình chuyển trạng thái Văn bản đi / Tờ trình nội bộ

import { TransitionRule } from "./types";
import { Permissions, SystemRoles } from "@/lib/constants";

export const outgoingTransitions: TransitionRule[] = [
  // 1. Chuyên viên trình Trưởng phòng duyệt dự thảo
  {
    from: "DRAFT",
    action: "SUBMIT_FOR_REVIEW",
    to: "PENDING_REVIEW",
    allowedRoles: [SystemRoles.SPECIALIST, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_CREATE,
    labelVi: "Trình duyệt dự thảo",
    isOptimisticAllowed: true,
    condition: (ctx) => {
      // Bắt buộc phải có file đính kèm trước khi trình
      if (ctx.additionalData && ctx.additionalData.hasFile === false) {
        return false;
      }
      return true;
    },
    conditionDescriptionVi: "Dự thảo bắt buộc phải có ít nhất một file đính kèm",
    notifyTargetRole: [SystemRoles.DEPT_HEAD],
    notifyTitleTemplate: "Dự thảo văn bản đi mới chờ duyệt sơ bộ",
  },

  // 2. Trưởng phòng duyệt đạt -> Chuyển Lãnh đạo phê duyệt/ký
  {
    from: "PENDING_REVIEW",
    action: "REVIEW_APPROVE",
    to: "PENDING_APPROVAL",
    allowedRoles: [SystemRoles.DEPT_HEAD, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_REVIEW,
    labelVi: "Duyệt & Trình Lãnh đạo",
    isOptimisticAllowed: true,
    notifyTargetRole: [SystemRoles.LEADER],
    notifyTitleTemplate: "Dự thảo văn bản đi chờ Lãnh đạo phê duyệt và ký",
  },

  // 3. Trưởng phòng trả lại dự thảo
  {
    from: "PENDING_REVIEW",
    action: "REVIEW_REJECT",
    to: "RETURNED",
    allowedRoles: [SystemRoles.DEPT_HEAD, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_REVIEW,
    requiresReason: true,
    labelVi: "Trả lại dự thảo",
    isOptimisticAllowed: true,
    notifyTargetRole: [SystemRoles.SPECIALIST],
    notifyTitleTemplate: "Dự thảo văn bản đi bị trả lại yêu cầu chỉnh sửa",
  },

  // 4. Chuyên viên chỉnh sửa và trình lại
  {
    from: "RETURNED",
    action: "RESUBMIT",
    to: "PENDING_REVIEW",
    allowedRoles: [SystemRoles.SPECIALIST, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_CREATE,
    labelVi: "Trình lại dự thảo",
    isOptimisticAllowed: true,
    notifyTargetRole: [SystemRoles.DEPT_HEAD],
    notifyTitleTemplate: "Dự thảo văn bản đi đã được sửa đổi và trình lại",
  },

  // 5. Lãnh đạo phê duyệt / Ký điện tử
  {
    from: "PENDING_APPROVAL",
    action: "LEADER_APPROVE",
    to: "APPROVED",
    allowedRoles: [SystemRoles.LEADER, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_APPROVE,
    labelVi: "Phê duyệt & Ký số",
    isOptimisticAllowed: true,
    notifyTargetRole: [SystemRoles.CLERK],
    notifyTitleTemplate: "Văn bản đi đã được ký duyệt, chờ văn thư cấp số",
  },

  // 6. Lãnh đạo trả lại dự thảo
  {
    from: "PENDING_APPROVAL",
    action: "LEADER_REJECT",
    to: "RETURNED",
    allowedRoles: [SystemRoles.LEADER, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_APPROVE,
    requiresReason: true,
    labelVi: "Trả lại dự thảo",
    isOptimisticAllowed: true,
    notifyTargetRole: [SystemRoles.SPECIALIST, SystemRoles.DEPT_HEAD],
    notifyTitleTemplate: "Lãnh đạo không đồng ý duyệt dự thảo, yêu cầu hoàn thiện lại",
  },

  // 7. Văn thư vào sổ và cấp số văn bản (QUY TẮC: KHÔNG DÙNG OPTIMISTIC UI)
  {
    from: "APPROVED",
    action: "REGISTER_NUMBER",
    to: "NUMBERED",
    allowedRoles: [SystemRoles.CLERK, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_NUMBER,
    labelVi: "Cấp số văn bản",
    isOptimisticAllowed: false, // Bắt buộc: Cấp số phải đợi server xác nhận atomic counter
    notifyTargetRole: [SystemRoles.CLERK, SystemRoles.SPECIALIST],
    notifyTitleTemplate: "Văn bản đã được cấp số chính thức",
  },

  // 8. Văn thư phát hành văn bản đi (QUY TẮC: KHÔNG DÙNG OPTIMISTIC UI)
  {
    from: "NUMBERED",
    action: "ISSUE",
    to: "ISSUED",
    allowedRoles: [SystemRoles.CLERK, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_ISSUE,
    labelVi: "Ban hành văn bản",
    isOptimisticAllowed: false, // Ban hành chính thức, khóa file
    notifyTargetRole: [SystemRoles.SPECIALIST, SystemRoles.DEPT_HEAD, SystemRoles.LEADER],
    notifyTitleTemplate: "Văn bản đã được ban hành chính thức",
  },

  // 9. Thu hồi văn bản sau khi ban hành (QUY TẮC: KHÔNG DÙNG OPTIMISTIC UI)
  {
    from: "ISSUED",
    action: "RECALL",
    to: "RECALLED",
    allowedRoles: [SystemRoles.LEADER, SystemRoles.CLERK, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_RECALL,
    requiresReason: true,
    labelVi: "Thu hồi văn bản",
    isOptimisticAllowed: false,
    notifyTargetRole: [SystemRoles.SPECIALIST, SystemRoles.DEPT_HEAD, SystemRoles.LEADER],
    notifyTitleTemplate: "Văn bản đã ban hành bị thu hồi",
  },

  // 10. Thay thế văn bản sau khi ban hành (QUY TẮC: KHÔNG DÙNG OPTIMISTIC UI)
  {
    from: "ISSUED",
    action: "REPLACE",
    to: "REPLACED",
    allowedRoles: [SystemRoles.LEADER, SystemRoles.CLERK, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_REPLACE,
    requiresReason: true,
    labelVi: "Thay thế văn bản",
    isOptimisticAllowed: false,
    notifyTargetRole: [SystemRoles.SPECIALIST, SystemRoles.DEPT_HEAD, SystemRoles.LEADER],
    notifyTitleTemplate: "Văn bản đã ban hành bị thay thế",
  },

  // 11. Hủy văn bản trước khi ban hành (QUY TẮC: KHÔNG DÙNG OPTIMISTIC UI)
  {
    from: "DRAFT",
    action: "CANCEL",
    to: "CANCELLED",
    allowedRoles: [SystemRoles.SPECIALIST, SystemRoles.DEPT_HEAD, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_CANCEL,
    requiresReason: true,
    labelVi: "Hủy dự thảo",
    isOptimisticAllowed: false,
  },
  {
    from: "PENDING_REVIEW",
    action: "CANCEL",
    to: "CANCELLED",
    allowedRoles: [SystemRoles.DEPT_HEAD, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_CANCEL,
    requiresReason: true,
    labelVi: "Hủy văn bản",
    isOptimisticAllowed: false,
  },
  {
    from: "PENDING_APPROVAL",
    action: "CANCEL",
    to: "CANCELLED",
    allowedRoles: [SystemRoles.LEADER, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_CANCEL,
    requiresReason: true,
    labelVi: "Hủy văn bản",
    isOptimisticAllowed: false,
  },
  {
    from: "APPROVED",
    action: "CANCEL",
    to: "CANCELLED",
    allowedRoles: [SystemRoles.LEADER, SystemRoles.CLERK, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_CANCEL,
    requiresReason: true,
    labelVi: "Hủy văn bản",
    isOptimisticAllowed: false,
  },
  {
    from: "NUMBERED",
    action: "CANCEL",
    to: "CANCELLED",
    allowedRoles: [SystemRoles.LEADER, SystemRoles.CLERK, SystemRoles.ADMIN],
    requiredPermission: Permissions.OUTGOING_CANCEL,
    requiresReason: true,
    labelVi: "Hủy văn bản đã cấp số",
    isOptimisticAllowed: false, // Số văn bản ghi nhận là đã hủy, không tái cấp
  },
];
