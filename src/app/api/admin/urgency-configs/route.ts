// src/app/api/admin/urgency-configs/route.ts
// API xem và cấu hình các mức Độ khẩn (Urgency Levels) & SLA

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api-response";
import { BusinessError } from "@/lib/errors";
import { z } from "zod";

const DEFAULT_URGENCY_CONFIGS = [
  {
    code: "NORMAL",
    name: "Bình thường",
    slaHours: 48,
    color: "slate",
    description: "Văn bản, hồ sơ xử lý theo trình tự và thời hạn tiêu chuẩn (tối đa 48 giờ làm việc)",
    isDefault: true,
    requireReason: false,
  },
  {
    code: "URGENT",
    name: "Khẩn",
    slaHours: 24,
    color: "amber",
    description: "Văn bản, hồ sơ có tính cấp bách cần giải quyết ưu tiên trong vòng 24 giờ",
    isDefault: false,
    requireReason: false,
  },
  {
    code: "FIRE",
    name: "Hỏa tốc",
    slaHours: 4,
    color: "rose",
    description: "Văn bản, hồ sơ tối khẩn cấp cần giải quyết ngay tức thì (tối đa 4 giờ làm việc)",
    isDefault: false,
    requireReason: true,
  },
];

const urgencyItemSchema = z.object({
  code: z.enum(["NORMAL", "URGENT", "FIRE"]),
  name: z.string().trim().min(1, "Tên mức độ khẩn không được để trống").max(50),
  slaHours: z.coerce.number().int().min(1, "Thời gian SLA tối thiểu 1 giờ").max(720),
  color: z.string().default("slate"),
  description: z.string().max(500).optional().default(""),
  isDefault: z.boolean().default(false),
  requireReason: z.boolean().default(false),
});

const updateUrgencyConfigsSchema = z.object({
  configs: z.array(urgencyItemSchema).min(1, "Danh sách cấu hình không được để trống"),
});

export async function GET() {
  try {
    await requirePermission(Permissions.CATALOG_VIEW);

    const setting = await prisma.systemSetting.findUnique({
      where: { key: "urgency_configs" },
    });

    if (!setting) {
      return successResponse(DEFAULT_URGENCY_CONFIGS);
    }

    try {
      const parsed = JSON.parse(setting.value);
      return successResponse(parsed);
    } catch {
      return successResponse(DEFAULT_URGENCY_CONFIGS);
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requirePermission(Permissions.ADMIN_SYSTEM);

    const body = await request.json();
    const parsed = updateUrgencyConfigsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BusinessError("VALIDATION_ERROR", parsed.error.issues[0]?.message);
    }

    // Đảm bảo chỉ có 1 default
    const hasDefault = parsed.data.configs.some((c) => c.isDefault);
    if (!hasDefault && parsed.data.configs.length > 0) {
      parsed.data.configs[0].isDefault = true;
    }

    await prisma.systemSetting.upsert({
      where: { key: "urgency_configs" },
      update: {
        value: JSON.stringify(parsed.data.configs),
      },
      create: {
        key: "urgency_configs",
        value: JSON.stringify(parsed.data.configs),
        description: "Cấu hình các mức độ khẩn cấp, SLA giờ xử lý và nhãn hiển thị",
      },
    });

    return successResponse(parsed.data.configs);
  } catch (error) {
    return errorResponse(error);
  }
}

