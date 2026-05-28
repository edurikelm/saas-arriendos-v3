import type { Metadata } from "next";
import { getSession } from "@/lib/actions/auth";
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
  const session = await getSession();

  return (
    <DashboardLayoutClient
      children={children}
      userName={session?.email?.split("@")[0] ?? null}
      userRole={session?.role ?? null}
      userPlan={session?.plan ?? null}
    />
  );
}
