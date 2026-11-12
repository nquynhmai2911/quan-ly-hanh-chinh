// src/modules/document/state-machine/types.ts
// Định nghĩa kiểu dữ liệu cho State Machine một cửa

import { DocumentStatus, DocumentDirection, DataScope } from "@prisma/client";

/** Danh mục các hành động chuyển trạng thái */
export type DocumentAction =
  // ── Hành động Văn bản đến ──
  | "RECEIVE_CITIZEN"
  | "SUBMIT_LEADER" // Văn thư trình Lãnh đạo
  | "LEADER_ANNOTATE" // Lãnh đạo bút phê và giao đơn vị
  | "RETURN_CLERK" // Lãnh đạo trả lại văn thư
  | "DEPT_HEAD_ASSIGN" // Trưởng phòng phân công chuyên viên
  | "DEPT_HEAD_RETURN" // Trưởng phòng trả lại Lãnh đạo
  | "SPECIALIST_REPORT" // Chuyên viên nộp báo cáo kết quả
  | "SUBMIT_REVIEW" // Trưởng phòng trình duyệt hoàn thành
  | "APPROVE_COMPLETE" // Xác nhận hoàn thành văn bản đến
  | "REJECT_REPORT" // Trả lại báo cáo, yêu cầu thụ lý lại

  // ── Hành động Văn bản đi ──
  | "SUBMIT_FOR_REVIEW" // Chuyên viên trình Trưởng phòng duyệt dự thảo
  | "REVIEW_APPROVE" // Trưởng phòng duyệt sơ bộ đạt
  | "REVIEW_REJECT" // Trưởng phòng trả lại dự thảo
  | "RESUBMIT" // Chuyên viên cập nhật dự thảo và trình lại
  | "LEADER_APPROVE" // Lãnh đạo phê duyệt / ký điện tử
  | "LEADER_REJECT" // Lãnh đạo trả lại dự thảo
  | "REGISTER_NUMBER" // Văn thư cấp số văn bản an toàn
  | "ISSUE" // Ban hành chính thức
  | "RECALL" // Thu hồi văn bản sau ban hành
  | "REPLACE" // Thay thế văn bản sau ban hành
  | "CANCEL"; // Hủy văn bản

/** Ngữ cảnh thực thi chuyển trạng thái */
export interface StateMachineContext {
  userId: string;
  userPositionId: string;
  roles: string[]; // ["ADMIN", "LEADER", "DEPT_HEAD", "CLERK", "SPECIALIST"]
  permissions: string[]; // ["doc.incoming.annotate", ...]
  dataScope: DataScope;
  userUnitId?: string;
  document: {
    id: string;
    direction: DocumentDirection;
    status: DocumentStatus;
    creatorId: string;
    draftUnitId?: string | null;
    isLocked: boolean;
    documentNumber?: string | null;
  };
  // Dữ liệu bổ sung tùy chọn để kiểm tra điều kiện
  additionalData?: {
    allMainHandlersReported?: boolean;
    reason?: string;
    targetUserId?: string;
    targetUnitId?: string;
    hasSignature?: boolean;
    hasFile?: boolean;
    [key: string]: unknown;
  };
}

/** Cấu hình cho 1 bước chuyển trạng thái */
export interface TransitionRule {
  from: DocumentStatus;
  action: DocumentAction;
  to: DocumentStatus;
  allowedRoles: string[]; // Vai trò được phép: LEADER, DEPT_HEAD...
  requiredPermission: string; // Permission code bắt buộc
  requiresReason?: boolean; // Bắt buộc nhập lý do (trả lại, hủy, thu hồi...)
  isOptimisticAllowed: boolean; // Có cho phép Optimistic UI không
  labelVi: string; // Tên nút tiếng Việt hiển thị trên UI
  condition?: (ctx: StateMachineContext) => boolean; // Kiểm tra logic bổ sung
  conditionDescriptionVi?: string; // Giải thích điều kiện nếu vi phạm
  notifyTargetRole?: string[]; // Ai sẽ nhận thông báo khi chuyển trạng thái xong
  notifyTitleTemplate?: string;
}

/** Kết quả lấy danh sách nút thao tác hợp lệ cho UI */
export interface AllowedAction {
  action: DocumentAction;
  label: string;
  toStatus: DocumentStatus;
  requiresReason: boolean;
  isOptimisticAllowed: boolean;
}

/** Tham số đầu vào cho hàm executeDocumentTransition */
export interface ExecuteTransitionInput {
  documentId: string;
  action: DocumentAction;
  actorId: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  payload?: Record<string, unknown>;
}
