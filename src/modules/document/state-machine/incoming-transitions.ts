// src/modules/document/state-machine/incoming-transitions.ts
// Bảng cấu hình chuyển trạng thái Văn bản đến (Quy trình Văn thư Một cửa)

import { TransitionRule } from "./types";
import { Permissions, SystemRoles } from "@/lib/constants";

export const incomingTransitions: TransitionRule[] = [
  // 1. Văn thư sau khi vào sổ trình Lãnh đạo cho ý kiến
  {
    from: "RECEIVED",
    action: "SUBMIT_LEADER",
    to: "PENDING_LEADER",
    allowedRoles: [SystemRoles.CLERK, SystemRoles.ADMIN],
    requiredPermission: Permissions.INCOMING_FORWARD,
    labelVi: "Trình Lãnh đạo",
    isOptimisticAllowed: true,
    notifyTargetRole: [SystemRoles.LEADER],
    notifyTitleTemplate: "Văn bản đến mới chờ cho ý kiến chỉ đạo",
  },

  // 2. Lãnh đạo bút phê và chuyển đơn vị xử lý
  {
    from: "PENDING_LEADER",
    action: "LEADER_ANNOTATE",
    to: "DISTRIBUTED",
    allowedRoles: [SystemRoles.LEADER, SystemRoles.ADMIN],
    requiredPermission: Permissions.INCOMING_ANNOTATE,
    labelVi: "Bút phê & Phân phối",
    isOptimisticAllowed: true,
    notifyTargetRole: [SystemRoles.DEPT_HEAD],
    notifyTitleTemplate: "Văn bản đến có bút phê chỉ đạo từ Lãnh đạo",
  },

  // 3. Lãnh đạo trả lại văn thư (ví dụ scan mờ, thiếu tài liệu, sai thẩm quyền)
  {
    from: "PENDING_LEADER",
    action: "RETURN_CLERK",
    to: "RECEIVED",
    allowedRoles: [SystemRoles.LEADER, SystemRoles.ADMIN],
    requiredPermission: Permissions.INCOMING_ANNOTATE,
    requiresReason: true,
    labelVi: "Trả lại văn thư",
    isOptimisticAllowed: true,
    notifyTargetRole: [SystemRoles.CLERK],
    notifyTitleTemplate: "Lãnh đạo trả lại văn bản đến yêu cầu kiểm tra lại",
  },

  // 4. Trưởng phòng phân công cho chuyên viên thụ lý
  {
    from: "DISTRIBUTED",
    action: "DEPT_HEAD_ASSIGN",
    to: "PROCESSING",
    allowedRoles: [SystemRoles.DEPT_HEAD, SystemRoles.ADMIN],
    requiredPermission: Permissions.INCOMING_ASSIGN,
    labelVi: "Phân công chuyên viên",
    isOptimisticAllowed: true,
    notifyTargetRole: [SystemRoles.SPECIALIST],
    notifyTitleTemplate: "Bạn được phân công xử lý văn bản đến",
  },

  // 5. Trưởng phòng trả lại Lãnh đạo (nếu không thuộc chức năng nhiệm vụ phòng)
  {
    from: "DISTRIBUTED",
    action: "DEPT_HEAD_RETURN",
    to: "PENDING_LEADER",
    allowedRoles: [SystemRoles.DEPT_HEAD, SystemRoles.ADMIN],
    requiredPermission: Permissions.INCOMING_ASSIGN,
    requiresReason: true,
    labelVi: "Trả lại Lãnh đạo",
    isOptimisticAllowed: true,
    notifyTargetRole: [SystemRoles.LEADER],
    notifyTitleTemplate: "Phòng ban đề xuất chuyển đơn vị khác thụ lý",
  },

  // 6. Trình duyệt hoàn thành (Chuyên viên chủ trì báo cáo kết quả -> Trưởng phòng tổng hợp trình duyệt)
  {
    from: "PROCESSING",
    action: "SUBMIT_REVIEW",
    to: "PENDING_REVIEW",
    allowedRoles: [SystemRoles.DEPT_HEAD, SystemRoles.SPECIALIST, SystemRoles.ADMIN],
    requiredPermission: Permissions.INCOMING_PROCESS,
    labelVi: "Trình duyệt kết thúc",
    isOptimisticAllowed: true,
    condition: (ctx) => {
      // Quy tắc nghiệp vụ bắt buộc: Tất cả handler vai trò MAIN phải nộp báo cáo kết quả
      if (ctx.additionalData && ctx.additionalData.allMainHandlersReported === false) {
        return false;
      }
      return true;
    },
    conditionDescriptionVi: "Tất cả chuyên viên chủ trì (MAIN) phải nộp báo cáo kết quả trước khi trình duyệt kết thúc",
    notifyTargetRole: [SystemRoles.DEPT_HEAD, SystemRoles.LEADER],
    notifyTitleTemplate: "Văn bản đến đang chờ xác nhận hoàn thành",
  },

  // 7. Xác nhận hoàn thành văn bản đến
  {
    from: "PENDING_REVIEW",
    action: "APPROVE_COMPLETE",
    to: "COMPLETED",
    allowedRoles: [SystemRoles.DEPT_HEAD, SystemRoles.LEADER, SystemRoles.ADMIN],
    requiredPermission: Permissions.INCOMING_COMPLETE,
    labelVi: "Xác nhận hoàn thành",
    isOptimisticAllowed: true,
    notifyTargetRole: [SystemRoles.SPECIALIST, SystemRoles.CLERK],
    notifyTitleTemplate: "Văn bản đến đã được duyệt hoàn thành",
  },

  // 8. Trả lại yêu cầu xử lý tiếp / bổ sung báo cáo
  {
    from: "PENDING_REVIEW",
    action: "REJECT_REPORT",
    to: "PROCESSING",
    allowedRoles: [SystemRoles.DEPT_HEAD, SystemRoles.LEADER, SystemRoles.ADMIN],
    requiredPermission: Permissions.INCOMING_COMPLETE,
    requiresReason: true,
    labelVi: "Yêu cầu bổ sung báo cáo",
    isOptimisticAllowed: true,
    notifyTargetRole: [SystemRoles.SPECIALIST],
    notifyTitleTemplate: "Báo cáo xử lý văn bản bị trả lại yêu cầu bổ sung",
  },
];
