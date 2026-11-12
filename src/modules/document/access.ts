import { Prisma } from "@prisma/client";
import type { AuthContext } from "@/types/auth";
import { buildDataScopeFilter } from "@/lib/auth/guard";
import { Permissions } from "@/lib/constants";
import { incomingScope } from "./incoming/access";
export async function documentScope(
  ctx: AuthContext,
): Promise<Prisma.DocumentWhereInput> {
  const outgoing = await buildDataScopeFilter(ctx, Permissions.OUTGOING_VIEW);
  return { OR: [incomingScope(ctx), { direction: "OUTGOING", ...outgoing }] };
}
