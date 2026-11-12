import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/types/auth";
import { Permissions } from "@/lib/constants";

export const isAdmin = (ctx: AuthContext) => ctx.roleCodes.includes("ADMIN");
export const hasRolePermission = (
  ctx: AuthContext,
  role: string,
  permission: string,
) =>
  isAdmin(ctx) ||
  (ctx.roleCodes.includes(role) && ctx.permissions.has(permission));
export const isCitizen = (ctx: AuthContext) =>
  ctx.roleCodes.includes("CITIZEN") &&
  !ctx.roleCodes.some((r) =>
    ["ADMIN", "CLERK", "LEADER", "DEPT_HEAD", "SPECIALIST"].includes(r),
  );

export function incomingScope(ctx: AuthContext): Prisma.DocumentWhereInput {
  if (isCitizen(ctx))
    return {
      direction: "INCOMING",
      creatorId: ctx.userId,
      workflow: { trackingCode: { not: null } },
    };
  if (
    isAdmin(ctx) ||
    hasRolePermission(ctx, "CLERK", Permissions.INCOMING_VIEW)
  )
    return { direction: "INCOMING" };
  if (!ctx.permissions.has(Permissions.INCOMING_VIEW))
    return { id: "__no_access__" };
  return {
    direction: "INCOMING",
    OR: [
      { creatorId: ctx.userId },
      { workflow: { leaderId: ctx.userId } },
      { workflow: { headId: ctx.userId } },
      { handlers: { some: { assigneeId: ctx.userId } } },
    ],
  };
}
