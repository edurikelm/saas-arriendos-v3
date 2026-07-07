"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  Building2,
  Users,
  Wallet,
  BarChart3,
  Settings,
  LifeBuoy,
  X,
  MoreVertical,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
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
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/calendar", icon: Calendar, label: "Calendario" },
  { href: "/reservations", icon: BookOpen, label: "Reservas" },
  { href: "/properties", icon: Building2, label: "Propiedades" },
  { href: "/clients", icon: Users, label: "Clientes" },
  { href: "/payments", icon: Wallet, label: "Pagos" },
  { href: "/reports", icon: BarChart3, label: "Reportes" },
  { href: "/settings", icon: Settings, label: "Configuración" },
  { href: "/support", icon: LifeBuoy, label: "Soporte" },
];

interface DashboardSidebarProps {
  open?: boolean;
  onClose?: () => void;
  userName?: string | null;
  userRole?: string | null;
  userPlan?: string | null;
  supportUnreadCount?: number;
}

export function DashboardSidebar({
  open,
  onClose,
  userName,
  userRole,
  userPlan,
  supportUnreadCount = 0,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration safety
    setMounted(true);
  }, []);

  const initial = (userName?.[0] ?? "R").toUpperCase();
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const planLabel = isSuperAdmin ? "ADMIN" : userPlan ?? "FREE";

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
          "fixed left-0 top-0 z-50 h-screen w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 lg:z-40 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded bg-primary flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-foreground">RentalPro</span>
            </div>
          </div>

          {/* Mobile close button */}
          <div className="flex items-center justify-between p-6 lg:hidden">
            <span className="text-lg font-bold text-foreground">RentalPro</span>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-sidebar-accent">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/support" && supportUnreadCount > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">
                      {supportUnreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Footer */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 px-2">
              <div className="h-8 w-8 rounded-full bg-muted border border-border overflow-hidden shrink-0">
                <div className="h-full w-full flex items-center justify-center bg-primary text-primary-foreground text-xs font-bold">
                  {initial}
                </div>
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{userName ?? "Cuenta"}</p>
                <p className="text-[10px] text-muted truncate">{planLabel}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                      <button className="p-1 rounded text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    }
                  />
                <DropdownMenuContent align="end" className="w-48">
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
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
