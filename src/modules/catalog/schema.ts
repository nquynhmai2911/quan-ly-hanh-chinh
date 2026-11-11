// src/modules/catalog/schema.ts
// Zod schemas cho Danh mục — dùng chung client & server

import { z } from "zod";

// ── Loại văn bản ────────────────────────────────────────────────────────────

export const documentTypeSchema = z.object({
  name: z
    .string()
    .min(1, "Tên loại văn bản không được để trống")
    .max(100, "Tên loại văn bản tối đa 100 ký tự"),
  code: z
    .string()
    .min(1, "Ký hiệu không được để trống")
    .max(20, "Ký hiệu tối đa 20 ký tự")
    .regex(/^[A-Za-zĐđ]+$/, "Ký hiệu chỉ chứa chữ cái"),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type DocumentTypeFormData = z.infer<typeof documentTypeSchema>;

// ── Lĩnh vực ────────────────────────────────────────────────────────────────

export const fieldSchema = z.object({
  name: z
    .string()
    .min(1, "Tên lĩnh vực không được để trống")
    .max(100, "Tên lĩnh vực tối đa 100 ký tự"),
  code: z
    .string()
    .min(1, "Ký hiệu không được để trống")
    .max(20, "Ký hiệu tối đa 20 ký tự")
    .regex(/^[A-Z0-9]+$/, "Ký hiệu chỉ chứa chữ IN HOA và số"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type FieldFormData = z.infer<typeof fieldSchema>;

// ── Cơ quan bên ngoài ───────────────────────────────────────────────────────

export const externalOrgSchema = z.object({
  name: z
    .string()
    .min(1, "Tên cơ quan không được để trống")
    .max(200, "Tên cơ quan tối đa 200 ký tự"),
  code: z
    .string()
    .min(1, "Ký hiệu không được để trống")
    .max(20, "Ký hiệu tối đa 20 ký tự"),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email("Email không hợp lệ").optional().nullable().or(z.literal("")),
  fax: z.string().max(20).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type ExternalOrgFormData = z.infer<typeof externalOrgSchema>;

// ── Sổ văn bản ──────────────────────────────────────────────────────────────

export const documentBookSchema = z.object({
  name: z
    .string()
    .min(1, "Tên sổ không được để trống")
    .max(200, "Tên sổ tối đa 200 ký tự"),
  code: z
    .string()
    .min(1, "Mã sổ không được để trống")
    .max(30, "Mã sổ tối đa 30 ký tự"),
  bookType: z.enum(["INCOMING", "OUTGOING"], {
    message: "Loại sổ không hợp lệ",
  }),
  unitId: z.string().optional().nullable(),
  documentTypeId: z.string().optional().nullable(),
  numberTemplate: z
    .string()
    .min(1, "Mẫu số không được để trống")
    .default("{number}/{typeCode}-{unitCode}"),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type DocumentBookFormData = z.infer<typeof documentBookSchema>;

// ── Đơn vị ──────────────────────────────────────────────────────────────────

export const unitSchema = z.object({
  name: z
    .string()
    .min(1, "Tên đơn vị không được để trống")
    .max(200, "Tên đơn vị tối đa 200 ký tự"),
  code: z
    .string()
    .min(1, "Ký hiệu không được để trống")
    .max(20, "Ký hiệu tối đa 20 ký tự")
    .regex(/^[A-Z0-9]+$/, "Ký hiệu chỉ chứa chữ IN HOA và số"),
  parentId: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type UnitFormData = z.infer<typeof unitSchema>;

// ── Chức danh ───────────────────────────────────────────────────────────────

export const positionSchema = z.object({
  name: z
    .string()
    .min(1, "Tên chức danh không được để trống")
    .max(100, "Tên chức danh tối đa 100 ký tự"),
  level: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type PositionFormData = z.infer<typeof positionSchema>;
