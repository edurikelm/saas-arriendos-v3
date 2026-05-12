import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/actions/auth";
import { AdminLayoutClient } from "@/components/layout/admin-layout-client";

export const metadata: Metadata = {
  title: "Admin - RentalPro",
  description: "Panel de administración",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSuperAdmin();

  return (
    <AdminLayoutClient
      children={children}
      userName={session.email.split("@")[0]}
      userRole={session.role}
    />
  );
}