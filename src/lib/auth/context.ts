// src/lib/auth/context.ts
// Tải Auth Context từ DB với cache 60s và cơ chế Invalidate ngay lập tức

import { prisma } from "@/lib/prisma";
import { DataScope } from "@prisma/client";
import { ActivePosition, AuthContext } from "@/types/auth";
import { AUTH_CONTEXT_CACHE_TTL } from "@/lib/constants";
import { DEMO_USERS, getDemoAuthContext } from "@/lib/demo-data";

// ── In-Memory Cache (TTL: 60s) ─────────────────────────────────────────────
interface CacheEntry {
  data: AuthContext;
  expiresAt: number;
}

const authContextCache = new Map<string, CacheEntry>();

/** Xóa cache khi có thay đổi chức vụ hoặc phân quyền */
export function invalidateAuthContext(userId?: string) {
  if (userId) {
    authContextCache.delete(userId);
  } else {
    authContextCache.clear();
  }
}

// Trọng số Data Scope để lấy phạm vi rộng nhất khi 1 user có nhiều vai trò
const SCOPE_WEIGHT: Record<DataScope, number> = {
  ALL: 4,
  UNIT_TREE: 3,
  UNIT: 2,
  OWN: 1,
};

/**
 * Tải Auth Context đầy đủ của người dùng (Chức danh, Đơn vị, Vai trò, Quyền, Data Scope)
 */
export async function getAuthContext(userId: string): Promise<AuthContext | null> {
  const now = Date.now();
  const cached = authContextCache.get(userId);

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // Kiểm tra tài khoản DEMO trước nếu id thuộc demo
  const demoUser = Object.values(DEMO_USERS).find(
    (u) => u.id === userId || u.employeeCode === userId || u.email === userId
  );

  let user: any = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      include: {
        positions: {
          where: {
            OR: [{ endedAt: null }, { endedAt: { gt: new Date() } }],
          },
          include: {
            unit: true,
            position: true,
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  } catch (dbErr) {
    console.warn("[AuthContext] Database offline, using DEMO context for userId:", userId);
  }

  // Fallback demo context
  if (!user && demoUser) {
    const demoCtx = getDemoAuthContext(demoUser);
    const authContext: AuthContext = {
      userId: demoUser.id,
      employeeCode: demoUser.employeeCode,
      fullName: demoUser.fullName,
      email: demoUser.email,
      avatarUrl: null,
      isActive: true,
      positions: [
        {
          userPositionId: `pos-${demoUser.id}`,
          positionId: `pos-${demoUser.id}`,
          positionName: demoUser.positionName,
          unitId: `unit-${demoUser.unitCode.toLowerCase()}`,
          unitCode: demoUser.unitCode,
          unitName: demoUser.unitName,
          isPrimary: true,
        },
      ],
      primaryPosition: {
        userPositionId: `pos-${demoUser.id}`,
        positionId: `pos-${demoUser.id}`,
        positionName: demoUser.positionName,
        unitId: `unit-${demoUser.unitCode.toLowerCase()}`,
        unitCode: demoUser.unitCode,
        unitName: demoUser.unitName,
        isPrimary: true,
      },
      permissions: new Map(demoCtx.permissions.map((p: string) => [p, demoUser.dataScope])),
      roleCodes: demoCtx.roleCodes,
    };

    authContextCache.set(userId, {
      data: authContext,
      expiresAt: now + AUTH_CONTEXT_CACHE_TTL * 1000,
    });

    return authContext;
  }

  if (!user) {
    return null;
  }

  // 1. Danh sách chức vụ đang hoạt động
  const activePositions: ActivePosition[] = user.positions.map((up: any) => ({
    userPositionId: up.id,
    unitId: up.unitId,
    unitCode: up.unit.code,
    unitName: up.unit.name,
    positionId: up.positionId,
    positionName: up.position.name,
    isPrimary: up.isPrimary,
  }));

  const primaryPosition = activePositions.find((p) => p.isPrimary) || activePositions[0] || null;

  // 2. Gom quyền và tính Data Scope cao nhất cho từng quyền
  const permissionsMap = new Map<string, DataScope>();
  const roleCodesSet = new Set<string>();

  for (const pos of user.positions) {
    for (const upr of pos.roles) {
      if (!upr.role.isActive) continue;

      roleCodesSet.add(upr.role.code);
      const roleScope = upr.dataScope as DataScope;

      for (const rp of upr.role.permissions) {
        const permCode = rp.permission.code;
        const currentScope = permissionsMap.get(permCode);

        if (!currentScope || SCOPE_WEIGHT[roleScope] > SCOPE_WEIGHT[currentScope]) {
          permissionsMap.set(permCode, roleScope);
        }
      }
    }
  }

  const authContext: AuthContext = {
    userId: user.id,
    employeeCode: user.employeeCode,
    fullName: user.fullName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    positions: activePositions,
    primaryPosition,
    permissions: permissionsMap,
    roleCodes: Array.from(roleCodesSet),
  };

  // Lưu vào cache
  authContextCache.set(userId, {
    data: authContext,
    expiresAt: now + AUTH_CONTEXT_CACHE_TTL * 1000,
  });

  return authContext;
}
