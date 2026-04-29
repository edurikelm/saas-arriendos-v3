import { ReactNode } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardNavbar } from "@/components/layout/dashboard-navbar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <div className="pl-64">
        <DashboardNavbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}