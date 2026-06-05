import type { Metadata } from "next";
import { requireOwner } from "@/lib/actions/auth";
import { DashboardLayoutClient } from "@/components/layout/dashboard-layout-client";

export const metadata: Metadata = {
  title: "Dashboard - RentalPro",
  description: "Gestiona tus propiedades y reservas",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOwner();

  return (
    <DashboardLayoutClient
      userName={session.email.split("@")[0]}
      userRole={session.role}
      userPlan={session.plan}
    >
      {children}
    </DashboardLayoutClient>
  );
}
