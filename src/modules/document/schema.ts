// src/modules/document/schema.ts
// Zod schemas cho Module Quản lý Văn bản (Dùng chung Client và Server)

import { z } from "zod";

// ── 1. Tiếp nhận văn bản đến (Vào sổ văn bản đến) ─────────────────────────
export const createIncomingDocumentSchema = z.object({
  title: z
    .string()
    .min(5, "Trích yếu văn bản tối thiểu 5 ký tự")
    .max(1000, "Trích yếu văn bản tối đa 1000 ký tự"),
  documentBookId: z.string().min(1, "Bắt buộc chọn sổ văn bản đến"),
  documentTypeId: z.string().min(1, "Bắt buộc chọn loại văn bản"),
  originalCode: z.string().max(100).optional().nullable(), // Số/ký hiệu gốc của cơ quan gửi
  senderOrgId: z.string().optional().nullable(), // Chọn từ danh mục cơ quan bên ngoài
  senderName: z.string().max(255).optional().nullable(), // Nhập tay nếu ngoài danh mục
  issuedDate: z.coerce.date({ message: "Ngày trên văn bản không hợp lệ" }),
  receivedDate: z.coerce.date().default(() => new Date()),
  processingDeadline: z.coerce.date().optional().nullable(),
  urgency: z.enum(["NORMAL", "URGENT", "FIRE"]).default("NORMAL"),
  security: z
    .enum(["NORMAL", "CONFIDENTIAL", "SECRET", "TOP_SECRET"])
    .default("NORMAL"),
  fieldId: z.string().optional().nullable(),
  summaryNotes: z.string().max(1000).optional().nullable(),
});

export type CreateIncomingDocumentFormData = z.infer<
  typeof createIncomingDocumentSchema
>;

// Metadata returned by /api/upload, retained when registering the document.
export const incomingDocumentSubmissionSchema =
  createIncomingDocumentSchema.extend({
    attachment: z
      .object({
        uploadId: z.string().optional(),
        fileKey: z
          .string()
          .min(1)
          .regex(/^[a-zA-Z0-9_.-]+$/),
        fileName: z.string().min(1),
        fileHash: z.string().regex(/^[a-f0-9]{64}$/),
        fileSize: z.number().int().nonnegative(),
        mimeType: z.string().min(1),
      })
      .optional(),
  });

// ── 2. Tạo dự thảo văn bản đi / Tờ trình ─────────────────────────────────
export const createOutgoingDraftSchema = z.object({
  title: z
    .string()
    .min(5, "Trích yếu dự thảo tối thiểu 5 ký tự")
    .max(1000, "Trích yếu dự thảo tối đa 1000 ký tự"),
  documentTypeId: z.string().min(1, "Bắt buộc chọn loại văn bản"),
  draftUnitId: z.string().min(1, "Bắt buộc chọn đơn vị chủ trì soạn thảo"),
  documentBookId: z.string().optional().nullable(), // Có thể chọn sổ trước hoặc khi cấp số
  urgency: z.enum(["NORMAL", "URGENT", "FIRE"]).default("NORMAL"),
  security: z
    .enum(["NORMAL", "CONFIDENTIAL", "SECRET", "TOP_SECRET"])
    .default("NORMAL"),
  fieldId: z.string().optional().nullable(),
  signerName: z.string().max(100).optional().nullable(),
  signerPosition: z.string().max(100).optional().nullable(),
  recipientsSummary: z.string().max(500).optional().nullable(),
  recipientType: z.enum(["SPECIALIST", "CITIZEN", "OTHER"]).default("OTHER"),
  recipientId: z.string().optional().nullable(),
  relatedDocumentId: z.string().optional().nullable(),
  sendType: z.string().max(50).optional().nullable(),
  summaryNotes: z.string().max(1000).optional().nullable(),
});

export type CreateOutgoingDraftFormData = z.infer<
  typeof createOutgoingDraftSchema
>;

// ── 3. Phân công xử lý văn bản đến ───────────────────────────────────────
export const assignHandlerSchema = z.object({
  documentId: z.string().min(1),
  handlers: z
    .array(
      z.object({
        assigneeId: z.string().min(1, "Bắt buộc chọn người xử lý"),
        unitId: z.string().optional().nullable(),
        role: z.enum(["MAIN", "COORDINATE", "INFO"], {
          message: "Vai trò xử lý không hợp lệ",
        }),
        deadline: z.coerce.date().optional().nullable(),
        instruction: z.string().max(500).optional().nullable(),
      }),
    )
    .min(1, "Bắt buộc phân công cho ít nhất một người xử lý")
    .refine(
      (handlers) => handlers.filter((h) => h.role === "MAIN").length === 1,
      { message: "Bắt buộc phải có đúng một người chủ trì (MAIN)" },
    ),
});

export type AssignHandlerFormData = z.infer<typeof assignHandlerSchema>;

// ── 4. Chuyên viên nộp báo cáo kết quả xử lý ──────────────────────────────
export const reportResultSchema = z.object({
  documentId: z.string().min(1),
  reportContent: z.string().min(5, "Báo cáo kết quả tối thiểu 5 ký tự"),
});

export type ReportResultFormData = z.infer<typeof reportResultSchema>;

// ── 5. Bút phê của Lãnh đạo ──────────────────────────────────────────────
export const annotateDocumentSchema = z.object({
  documentId: z.string().min(1),
  instruction: z.string().min(2, "Ý kiến chỉ đạo/bút phê không được để trống"),
  assignedUnitId: z.string().optional().nullable(),
  targetLeaderId: z.string().optional().nullable(),
});

export type AnnotateDocumentFormData = z.infer<typeof annotateDocumentSchema>;

// ── 6. Chuyển trạng thái qua State Machine ────────────────────────────────
export const transitionDocumentSchema = z.object({
  documentId: z.string().min(1),
  action: z.enum([
    "RECEIVE_CITIZEN",
    "CLERK_DISTRIBUTE",
    "SUBMIT_LEADER",
    "LEADER_ANNOTATE",
    "RETURN_CLERK",
    "DEPT_HEAD_ASSIGN",
    "DEPT_HEAD_RETURN",
    "SPECIALIST_REPORT",
    "SUBMIT_REVIEW",
    "APPROVE_COMPLETE",
    "REJECT_REPORT",
    "SUBMIT_FOR_REVIEW",
    "REVIEW_APPROVE",
    "REVIEW_REJECT",
    "RESUBMIT",
    "LEADER_APPROVE",
    "LEADER_REJECT",
    "REGISTER_NUMBER",
    "ISSUE",
    "RECALL",
    "REPLACE",
    "CANCEL",
  ]),
  reason: z.string().max(1000).optional(),
  leaderId: z.string().min(1).optional(),
  headId: z.string().min(1).optional(),
  unitId: z.string().min(1).optional(),
  documentBookId: z.string().min(1).optional(),
  processingDeadline: z.coerce.date().optional().nullable(),
});

export type TransitionDocumentFormData = z.infer<
  typeof transitionDocumentSchema
>;
