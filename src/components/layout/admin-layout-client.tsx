"use client";

import { ReactNode, useState } from "react";
import { DashboardSidebarAdmin } from "@/components/layout/dashboard-sidebar-admin";
import { DashboardNavbar } from "@/components/layout/dashboard-navbar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutClientProps {
  children: ReactNode;
  userName: string | null;
  userRole: string | null;
  supportUnreadCount?: number;
}

export function AdminLayoutClient({ children, userName, userRole, supportUnreadCount = 0 }: AdminLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebarAdmin
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        supportUnreadCount={supportUnreadCount}
        userName={userName}
        userRole={userRole}
      />
      <div className={sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"}>
        <div className="sticky top-0 z-30 flex items-center gap-4 bg-navbar px-4 py-3 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-bold text-lg">RentalPro Admin</span>
        </div>
        <DashboardNavbar />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}