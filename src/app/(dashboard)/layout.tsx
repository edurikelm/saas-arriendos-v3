import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth/guards";
import { getUnreadSupportTicketCount } from "@/lib/actions/support-unread";
import { getUnreadNotificationCount } from "@/lib/actions/notifications";
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
  const [supportUnreadCount, notificationUnreadCount] = await Promise.all([
    getUnreadSupportTicketCount(),
    getUnreadNotificationCount(),
  ]);

  return (
    <DashboardLayoutClient
      userName={session.email.split("@")[0]}
      userRole={session.role}
      userPlan={session.plan}
      supportUnreadCount={supportUnreadCount}
      notificationUnreadCount={notificationUnreadCount}
    >
      {children}
    </DashboardLayoutClient>
  );
}
