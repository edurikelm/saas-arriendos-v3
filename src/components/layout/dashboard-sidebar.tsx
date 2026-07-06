"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Building2, Calendar, Users, BarChart3, Settings, LifeBuoy, X, PanelLeftClose, PanelLeft, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/properties", icon: Building2, label: "Propiedades" },
  { href: "/reservations", icon: Calendar, label: "Reservas" },
  { href: "/calendar", icon: Calendar, label: "Calendario" },
  { href: "/clients", icon: Users, label: "Clientes" },
  { href: "/payments", icon: Wallet, label: "Pagos" },
  { href: "/reports", icon: BarChart3, label: "Reportes" },
  { href: "/support", icon: LifeBuoy, label: "Soporte" },
  { href: "/settings", icon: Settings, label: "Configuración" },
];

interface DashboardSidebarProps {
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
  supportUnreadCount?: number;
}

export function DashboardSidebar({ open, onClose, collapsed, onToggle, supportUnreadCount = 0 }: DashboardSidebarProps) {
  const pathname = usePathname();

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
          "fixed left-0 top-0 z-50 h-screen border-r border-sidebar-border bg-sidebar/95 text-sidebar-foreground backdrop-blur-xl transition-all duration-300 lg:z-40 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-16" : "lg:w-64"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-6 lg:hidden">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">RentalPro</h1>
              <p className="text-xs text-sidebar-foreground/60">Gestión de arriendos</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-sidebar-accent">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className={cn("hidden lg:flex lg:items-center", collapsed ? "lg:justify-center lg:px-2 lg:py-2" : "lg:justify-between lg:p-2 lg:pr-1")}>
            <div className={cn("overflow-hidden transition-all duration-200", collapsed ? "lg:w-0 lg:opacity-0" : "lg:w-auto lg:opacity-100")}>
              <h1 className="whitespace-nowrap text-xl font-bold tracking-tight">RentalPro</h1>
              <p className="whitespace-nowrap text-xs text-sidebar-foreground/60">Gestión de arriendos</p>
            </div>
            <button
              onClick={onToggle}
              className={cn(
                "flex h-10 shrink-0 items-center rounded-xl hover:bg-sidebar-accent",
                collapsed ? "px-3" : "w-10 justify-center"
              )}
              title={collapsed ? "Expandir menú" : "Colapsar menú"}
            >
              {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
          </div>
<nav className={cn("flex-1 space-y-1 px-3", collapsed ? "lg:px-2" : "lg:px-3")}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-ring/20"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className={cn("flex-1 transition-opacity duration-200", collapsed ? "lg:opacity-0 lg:w-0" : "lg:opacity-100")}>{item.label}</span>
                  {item.href === "/support" && supportUnreadCount > 0 && (
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
          </nav>
        </div>
      </aside>
    </>
  );
}
