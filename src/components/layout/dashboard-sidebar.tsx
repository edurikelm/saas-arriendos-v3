"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Building2, Calendar, Users, BarChart3, Settings, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/properties", icon: Building2, label: "Propiedades" },
  { href: "/reservations", icon: Calendar, label: "Reservas" },
  { href: "/calendar", icon: Calendar, label: "Calendario" },
  { href: "/clients", icon: Users, label: "Clientes" },
  { href: "/reports", icon: BarChart3, label: "Reportes" },
  { href: "/settings", icon: Settings, label: "Configuración" },
];

interface DashboardSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function DashboardSidebar({ open, onClose }: DashboardSidebarProps) {
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
          "fixed left-0 top-0 z-50 h-screen w-64 border-r border-sidebar-border bg-sidebar/95 text-sidebar-foreground shadow-xl backdrop-blur-xl transition-transform duration-300 lg:z-40 lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full"
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
          <div className="hidden p-6 lg:block">
            <h1 className="text-2xl font-bold tracking-tight">RentalPro</h1>
            <p className="mt-1 text-xs text-sidebar-foreground/60">Gestión de arriendos</p>
          </div>
          <nav className="flex-1 space-y-1 px-3">
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
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-ring/10"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-sidebar-border p-3">
            <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground">
              <FileText className="h-5 w-5" />
              Licencia
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
