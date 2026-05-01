"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, BarChart3, Settings, X } from "lucide-react";
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
}

export function DashboardSidebarAdmin({ open, onClose }: DashboardSidebarAdminProps) {
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
          "fixed left-0 top-0 z-50 h-screen w-64 bg-slate-900 text-white transition-transform duration-300 lg:z-40 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between p-6 lg:hidden">
            <h1 className="text-2xl font-bold">RentalPro Admin</h1>
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="hidden lg:block p-6">
            <h1 className="text-2xl font-bold">RentalPro Admin</h1>
          </div>
          <nav className="flex-1 space-y-1 px-3">
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
                    isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-4">
              <div className="border-t border-slate-800 my-2" />
              <p className="px-3 py-2 text-xs text-slate-500 uppercase tracking-wider">Próximamente</p>
              {placeholderItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 cursor-not-allowed"
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
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