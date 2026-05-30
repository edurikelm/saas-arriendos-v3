"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, BarChart3, Settings, X, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", icon: Home, label: "Dashboard" },
  { href: "/admin/users", icon: Users, label: "Usuarios" },
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
}

export function DashboardSidebarAdmin({ open, onClose, collapsed, onToggle }: DashboardSidebarAdminProps) {
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
          "fixed left-0 top-0 z-50 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 lg:z-40 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-16" : "lg:w-64"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-6 lg:hidden">
            <h1 className="text-2xl font-bold">RentalPro Admin</h1>
            <button onClick={onClose} className="p-2 hover:bg-sidebar-accent rounded-lg">
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
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className={cn("transition-opacity duration-200", collapsed ? "lg:opacity-0 lg:w-0" : "lg:opacity-100")}>{item.label}</span>
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
        </div>
      </aside>
    </>
  );
}