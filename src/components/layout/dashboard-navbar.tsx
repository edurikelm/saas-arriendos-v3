"use client";

import { Bell, HelpCircle, Search } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";

interface DashboardNavbarProps {
  notificationUnreadCount?: number;
}

export function DashboardNavbar({ notificationUnreadCount = 0 }: DashboardNavbarProps) {
  return (
    <header className="sticky top-0 h-16 w-full border-b border-border bg-white flex justify-between items-center px-6 z-50">
      {/* Izquierda: eyebrow */}
      <div className="hidden md:flex items-center text-xs text-muted font-medium uppercase tracking-wider">
        Panel de Administración
      </div>

      {/* Centro + Derecha: search + icons */}
      <div className="flex items-center gap-4">
        {/* Search bar */}
        <div className="hidden sm:flex items-center relative">
          <Search className="absolute left-3 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-background border-none rounded py-1.5 pl-9 pr-4 text-xs w-64 focus:ring-1 focus:ring-primary placeholder-muted text-foreground"
          />
        </div>

        {/* Icon buttons */}
        <div className="flex items-center gap-2">
          <button className="p-2 text-muted hover:text-foreground">
            <Bell className="h-5 w-5" />
          </button>
          <button className="p-2 text-muted hover:text-foreground">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
