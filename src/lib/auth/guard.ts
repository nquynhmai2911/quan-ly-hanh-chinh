// src/lib/auth/guard.ts
// Kiểm tra quyền 3 lớp: Service-level Permission & Data Scope filter generator

import { getCurrentUser } from "./session";
import { getAuthContext } from "./context";
import { BusinessError } from "@/lib/errors";
import { AuthContext } from "@/types/auth";
import { prisma } from "@/lib/prisma";
import { DataScope } from "@prisma/client";

/**
 * Yêu cầu người dùng phải đăng nhập, trả về AuthContext
 */
export async function requireAuth(): Promise<AuthContext> {
  const user = await getCurrentUser();
  if (!user) {
    throw new BusinessError("UNAUTHORIZED", "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
  }

  const ctx = await getAuthContext(user.id);
  if (!ctx || !ctx.isActive) {
    throw new BusinessError("FORBIDDEN", "Tài khoản của bạn đã bị khóa hoặc không có quyền truy cập.");
  }

  return ctx;
}

/**
 * Yêu cầu người dùng phải có quyền hạn (Permission code) cụ thể
 */
export async function requirePermission(permissionCode: string): Promise<AuthContext> {
  const ctx = await requireAuth();

  // Admin hệ thống có toàn quyền
  if (ctx.roleCodes.includes("ADMIN")) {
    return ctx;
  }

  if (!ctx.permissions.has(permissionCode)) {
    throw new BusinessError("FORBIDDEN", `Bạn không có quyền thực hiện chức năng này.`);
  }

  return ctx;
}

/**
 * Yêu cầu người dùng phải có vai trò (Role code) cụ thể
 */
export async function requireRole(roleCode: string): Promise<AuthContext> {
  const ctx = await requireAuth();

  if (ctx.roleCodes.includes("ADMIN")) {
    return ctx;
  }

  if (!ctx.roleCodes.includes(roleCode)) {
    throw new BusinessError("FORBIDDEN", `Thao tác yêu cầu vai trò '${roleCode}'.`);
  }

  return ctx;
}

/**
 * Lấy danh sách ID các đơn vị con (cây đệ quy) phục vụ Data Scope UNIT_TREE
 */
async function getUnitTreeIds(unitId: string): Promise<string[]> {
  const result: string[] = [unitId];

  async function fetchChildren(parentId: string) {
    const children = await prisma.unit.findMany({
      where: { parentId, isActive: true },
      select: { id: true },
    });
    for (const child of children) {
      result.push(child.id);
      await fetchChildren(child.id);
    }
  }

  await fetchChildren(unitId);
  return result;
}

interface DataScopeOptions {
  creatorField?: string;   // Mặc định: "creatorId"
  unitField?: string;      // Mặc định: "draftUnitId"
  assigneeField?: string;  // Dùng khi filter handler: "assigneeId"
}

/**
 * Sinh điều kiện WHERE của Prisma dựa theo Data Scope được gán cho quyền hạn
 */
export async function buildDataScopeFilter(
  ctx: AuthContext,
  permissionCode: string,
  options: DataScopeOptions = {}
): Promise<Record<string, unknown>> {
  // Admin luôn xem được tất cả metadata
  if (ctx.roleCodes.includes("ADMIN")) {
    return {};
  }

  const scope: DataScope = ctx.permissions.get(permissionCode) || "OWN";
  const creatorField = options.creatorField || "creatorId";
  const unitField = options.unitField || "draftUnitId";
  const primaryUnitId = ctx.primaryPosition?.unitId;

  switch (scope) {
    case "ALL":
      return {};

    case "UNIT_TREE": {
      if (!primaryUnitId) {
        return { [creatorField]: ctx.userId };
      }
      const unitIds = await getUnitTreeIds(primaryUnitId);
      return {
        OR: [
          { [unitField]: { in: unitIds } },
          { [creatorField]: ctx.userId },
        ],
      };
    }

    case "UNIT": {
      if (!primaryUnitId) {
        return { [creatorField]: ctx.userId };
      }
      return {
        OR: [
          { [unitField]: primaryUnitId },
          { [creatorField]: ctx.userId },
        ],
      };
    }

    case "OWN":
    default:
      return {
        OR: [
          { [creatorField]: ctx.userId },
          { handlers: { some: { assigneeId: ctx.userId } } },
        ],
      };
  }
}
