"use client";

import { ReactNode, useState } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardNavbar } from "@/components/layout/dashboard-navbar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardLayoutClientProps {
  children: ReactNode;
  userName: string | null;
  userRole: string | null;
  userPlan: string | null;
}

export function DashboardLayoutClient({ children, userName, userRole, userPlan }: DashboardLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="dashboard-shell-bg min-h-screen bg-background">
      <DashboardSidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className={sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"}>
        <div className="sticky top-0 z-30 flex items-center gap-4 border-b bg-navbar/90 px-4 py-3 shadow-sm backdrop-blur-xl lg:hidden">
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
        <DashboardNavbar userName={userName} userRole={userRole ?? undefined} userPlan={userPlan} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
