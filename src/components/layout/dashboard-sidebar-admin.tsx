"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Users, LifeBuoy, BarChart3, Settings, X, PanelLeftClose, PanelLeft, MoreVertical, LogOut, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/providers/theme-provider";
import { logoutAction } from "@/lib/actions/auth";

const navItems = [
  { href: "/admin", icon: Home, label: "Dashboard" },
  { href: "/admin/users", icon: Users, label: "Usuarios" },
  { href: "/admin/support", icon: LifeBuoy, label: "Soporte" },
];

const placeholderItems = [
  { icon: BarChart3, label: "Reportes" },
  { icon: Settings, label: "Config" },
];

interface DashboardSidebarAdminProps {
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
  supportUnreadCount?: number;
  userName?: string | null;
  userRole?: string | null;
}

export function DashboardSidebarAdmin({
  open,
  onClose,
  collapsed,
  onToggle,
  supportUnreadCount = 0,
  userName,
  userRole,
}: DashboardSidebarAdminProps) {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration safety
    setMounted(true);
  }, []);

  const initial = (userName?.[0] ?? "A").toUpperCase();
  const roleLabel = userRole === "SUPER_ADMIN" ? "SUPER ADMIN" : userRole ?? "ADMIN";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 lg:z-40 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-16" : "lg:w-64"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-6 lg:hidden">
            <h1 className="text-2xl font-bold">RentalPro Admin</h1>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className={cn("hidden lg:flex lg:items-center", collapsed ? "lg:justify-center lg:px-2 lg:py-2" : "lg:justify-between lg:p-2 lg:pr-1")}>
            <div className={cn("overflow-hidden transition-all duration-200", collapsed ? "lg:w-0 lg:opacity-0" : "lg:w-auto lg:opacity-100")}>
              <h1 className="whitespace-nowrap text-xl font-bold">RentalPro Admin</h1>
            </div>
            <button
              onClick={onToggle}
              className={cn(
                "flex h-10 shrink-0 items-center rounded-xl hover:bg-muted",
                collapsed ? "px-3" : "w-10 justify-center"
              )}
              title={collapsed ? "Expandir menú" : "Colapsar menú"}
            >
              {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
          </div>
          <nav className={cn("flex-1 space-y-1 px-3 overflow-y-auto", collapsed ? "lg:px-2" : "lg:px-3")}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className={cn("flex-1 transition-opacity duration-200", collapsed ? "lg:opacity-0 lg:w-0" : "lg:opacity-100")}>{item.label}</span>
                  {item.href === "/admin/support" && supportUnreadCount > 0 && (
                    <span className={cn(
                      "inline-flex items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground",
                      collapsed ? "lg:hidden" : ""
                    )}>
                      {supportUnreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
            <div className="pt-4">
              <div className="border-t border-sidebar-border my-2" />
              <p className={cn("px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider", collapsed ? "lg:hidden" : "")}>Próximamente</p>
              {placeholderItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed",
                      collapsed ? "lg:justify-center lg:px-0" : ""
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className={cn("transition-opacity duration-200", collapsed ? "lg:opacity-0 lg:w-0" : "lg:opacity-100")}>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </nav>

          {/* User Footer */}
          <div className={cn("border-t border-sidebar-border p-4", collapsed ? "lg:p-2" : "")}>
            <div className={cn("flex items-center gap-3", collapsed ? "lg:justify-center" : "")}>
              <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                      <button
                        aria-label="Más opciones de usuario"
                        className="h-8 w-8 rounded-full bg-muted border border-border overflow-hidden shrink-0 hover:ring-2 hover:ring-sidebar-accent transition-shadow"
                      >
                        <div className="h-full w-full flex items-center justify-center bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold">
                          {initial}
                        </div>
                      </button>
                    }
                  />
                <DropdownMenuContent
                  align={collapsed ? "start" : "end"}
                  side={collapsed ? "right" : "top"}
                  className="w-48"
                >
                  <div className="px-1.5 py-1.5">
                    <p className="text-sm font-medium text-foreground truncate">{userName ?? "Admin"}</p>
                    <p className="text-xs text-muted-foreground">{roleLabel}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Tema</DropdownMenuLabel>
                  {mounted ? (
                    <>
                      <DropdownMenuItem onClick={() => setTheme("light")}>
                        <Sun className="h-4 w-4 mr-2" />
                        Claro
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("dark")}>
                        <Moon className="h-4 w-4 mr-2" />
                        Oscuro
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("system")}>Sistema</DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem disabled>Claro</DropdownMenuItem>
                      <DropdownMenuItem disabled>Oscuro</DropdownMenuItem>
                      <DropdownMenuItem disabled>Sistema</DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
              {!collapsed && (
                <>
                  <div className="overflow-hidden flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{userName ?? "Admin"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{roleLabel}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                          <button
                            aria-label="Más opciones de usuario"
                            className="p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        }
                      />
                    <DropdownMenuContent align="end" className="w-48">
                      <form action={logoutAction}>
                        <button
                          type="submit"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          Cerrar sesión
                        </button>
                      </form>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}