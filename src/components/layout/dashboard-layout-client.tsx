"use client";

import { ReactNode, useState } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardNavbar } from "@/components/layout/dashboard-navbar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";

interface DashboardLayoutClientProps {
  children: ReactNode;
  userName: string | null;
  userRole: string | null;
  userPlan: string | null;
  supportUnreadCount?: number;
  notificationUnreadCount?: number;
}

export function DashboardLayoutClient({
  children,
  userName,
  userRole,
  userPlan,
  supportUnreadCount = 0,
  notificationUnreadCount = 0,
}: DashboardLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dashboard-shell-bg min-h-screen bg-background">
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userName={userName}
        userRole={userRole}
        userPlan={userPlan}
        supportUnreadCount={supportUnreadCount}
      />
      <div className="lg:pl-64">
        {/* Barra móvil: RentalPro + acciones */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="hover:bg-accent"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-bold text-lg">RentalPro</span>
          </div>
          <NotificationBell unreadCount={notificationUnreadCount} />
        </div>
        <DashboardNavbar notificationUnreadCount={notificationUnreadCount} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
