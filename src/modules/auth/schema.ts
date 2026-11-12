// src/modules/auth/schema.ts
// Zod schemas cho Auth — dùng chung client & server

import { z } from "zod";

// ── Đăng nhập ───────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().min(1, "Vui lòng nhập email hoặc mã nhân viên"),
  password: z
    .string()
    .min(1, "Mật khẩu không được để trống")
    .min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ── Đổi mật khẩu ───────────────────────────────────────────────────────────

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mật khẩu hiện tại không được để trống"),
    newPassword: z
      .string()
      .min(6, "Mật khẩu mới tối thiểu 6 ký tự")
      .max(100, "Mật khẩu mới tối đa 100 ký tự")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
        "Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt",
      ),
    confirmPassword: z.string().min(1, "Xác nhận mật khẩu không được để trống"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// ── Quản lý người dùng ──────────────────────────────────────────────────────

export const userSchema = z.object({
  employeeCode: z
    .string()
    .min(1, "Mã nhân viên không được để trống")
    .max(20, "Mã nhân viên tối đa 20 ký tự"),
  fullName: z
    .string()
    .min(1, "Họ tên không được để trống")
    .max(100, "Họ tên tối đa 100 ký tự"),
  email: z
    .string()
    .min(1, "Email không được để trống")
    .email("Email không hợp lệ"),
  phone: z.string().max(15).optional().nullable(),
  password: z
    .string()
    .min(6, "Mật khẩu tối thiểu 6 ký tự")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type UserFormData = z.infer<typeof userSchema>;
export const createUserSchema = userSchema;
export type CreateUserFormData = z.infer<typeof createUserSchema>;

// ── Gán chức vụ cho người dùng ──────────────────────────────────────────────

export const userPositionSchema = z.object({
  userId: z.string().min(1, "Người dùng không được để trống"),
  unitId: z.string().min(1, "Đơn vị không được để trống"),
  positionId: z.string().min(1, "Chức danh không được để trống"),
  isPrimary: z.boolean().default(false),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional().nullable(),
});

export type UserPositionFormData = z.infer<typeof userPositionSchema>;

// ── Gán vai trò cho chức vụ ─────────────────────────────────────────────────

export const userPositionRoleSchema = z.object({
  userPositionId: z.string().min(1),
  roleId: z.string().min(1, "Vai trò không được để trống"),
  dataScope: z.enum(["ALL", "UNIT_TREE", "UNIT", "OWN"], {
    message: "Phạm vi dữ liệu không hợp lệ",
  }),
});

export type UserPositionRoleFormData = z.infer<typeof userPositionRoleSchema>;
