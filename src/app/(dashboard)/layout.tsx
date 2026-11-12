// src/app/(dashboard)/layout.tsx
// Layout Server Component nạp AuthContext và truyền vào DashboardShell

import React from "react";
import { getCurrentUser, clearSessionCookie } from "@/lib/auth/session";
import { getAuthContext } from "@/lib/auth/context";
import { redirect } from "next/navigation";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const authContext = await getAuthContext(user.id);

  if (!authContext) {
    try {
      await clearSessionCookie();
    } catch {}
    redirect("/login?reauth=1");
  }

  const permissionsList = Array.from(authContext.permissions.keys());

  return (
    <DashboardShell
      user={user}
      roles={authContext?.roleCodes || []}
      permissions={permissionsList}
      primaryPositionName={
        authContext.roleCodes.includes("CITIZEN")
          ? "Người dân"
          : authContext.primaryPosition?.positionName
      }
      primaryUnitName={
        authContext.roleCodes.includes("CITIZEN")
          ? "Dịch vụ công"
          : authContext.primaryPosition?.unitName
      }
    >
      {children}
    </DashboardShell>
  );
}
