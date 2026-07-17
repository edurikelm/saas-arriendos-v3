"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardNavbar } from "@/components/layout/dashboard-navbar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { getUnreadNotificationCount, type RecentNotification } from "@/lib/actions/notifications";

interface DashboardLayoutClientProps {
  children: ReactNode;
  userName: string | null;
  userRole: string | null;
  userPlan: string | null;
  supportUnreadCount?: number;
  notificationUnreadCount?: number;
  initialNotifications?: RecentNotification[];
}

export function DashboardLayoutClient({
  children,
  userName,
  userRole,
  userPlan,
  supportUnreadCount = 0,
  notificationUnreadCount = 0,
  initialNotifications,
}: DashboardLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [liveNotificationUnreadCount, setLiveNotificationUnreadCount] = useState(notificationUnreadCount);

  const refreshUnreadCount = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const count = await getUnreadNotificationCount();
      setLiveNotificationUnreadCount(count);
    } catch {
      // Best-effort polling — ignore errors
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshUnreadCount, 30_000);
    const onFocus = () => { void refreshUnreadCount(); };
    const onVisibilityChange = () => { if (document.visibilityState === "visible") { void refreshUnreadCount(); } };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshUnreadCount]);

  const handleNotificationsRead = useCallback(() => {
    setLiveNotificationUnreadCount(0);
  }, []);

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
        <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-background px-4 py-3 lg:hidden">
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
          <NotificationBell
            unreadCount={liveNotificationUnreadCount}
            initialNotifications={initialNotifications}
            onNotificationsRead={handleNotificationsRead}
          />
        </div>
        <DashboardNavbar
          notificationUnreadCount={liveNotificationUnreadCount}
          initialNotifications={initialNotifications}
          onNotificationsRead={handleNotificationsRead}
        />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
