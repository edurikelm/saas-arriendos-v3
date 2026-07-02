"use client";

import { ReactNode, useState, useEffect } from "react";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardNavbar } from "@/components/layout/dashboard-navbar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/providers/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/actions/auth";

interface DashboardLayoutClientProps {
  children: ReactNode;
  userName: string | null;
  userRole: string | null;
  userPlan: string | null;
  supportUnreadCount?: number;
  notificationUnreadCount?: number;
}

export function DashboardLayoutClient({ children, userName, userRole, userPlan, supportUnreadCount = 0, notificationUnreadCount = 0 }: DashboardLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const initial = (userName?.[0] ?? "R").toUpperCase();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration safety
    setMounted(true);
  }, []);

  return (
    <div className="dashboard-shell-bg min-h-screen bg-background">
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        supportUnreadCount={supportUnreadCount}
      />
      <div className={sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"}>
        {/* Barra móvil: RentalPro + acciones */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-navbar/90 px-4 py-3 shadow-sm backdrop-blur-xl lg:hidden">
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
          <div className="flex items-center gap-1 rounded-lg border bg-background/70 p-1 shadow-xs">
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Cambiar tema" className="rounded-lg" />}>
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Cambiar tema</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => setTheme("light")}>Claro</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")}>Oscuro</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")}>Sistema</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="icon" disabled className="rounded-lg">
                <Moon className="h-5 w-5" />
              </Button>
            )}
            <NotificationBell unreadCount={notificationUnreadCount} />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" aria-label="Menú de usuario" className="h-9 rounded-lg px-1.5 pr-2" />}>
                <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                  {initial}
                </span>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                  <span className="block text-foreground">{userName ?? "Cuenta RentalPro"}</span>
                  <span className="block text-xs font-normal text-muted-foreground">Plan {userPlan ?? "FREE"}</span>
                </div>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <DashboardNavbar userName={userName} userRole={userRole ?? undefined} userPlan={userPlan} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
