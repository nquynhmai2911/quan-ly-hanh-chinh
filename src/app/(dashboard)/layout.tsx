// src/app/(dashboard)/layout.tsx
// Layout Server Component nạp AuthContext và truyền vào DashboardShell

import React from "react";
import { getCurrentUser } from "@/lib/auth/session";
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

  return (
    <DashboardShell
      user={user}
      roles={authContext?.roleCodes || []}
      primaryPositionName={authContext?.primaryPosition?.positionName}
      primaryUnitName={authContext?.primaryPosition?.unitName}
    >
      {children}
    </DashboardShell>
  );
}
