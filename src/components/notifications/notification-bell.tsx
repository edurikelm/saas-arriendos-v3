"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  unreadCount: number;
}

export function NotificationBell({ unreadCount }: NotificationBellProps) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notificaciones"
        className="rounded-lg"
      >
        <Bell className="h-5 w-5" />
      </Button>
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full",
            "bg-destructive px-1 py-0.5 text-xs font-bold text-destructive-foreground",
            "min-w-[1.125rem] min-h-[1.125rem]", // ensure badge is always visible
            unreadCount > 99 ? "px-1" : "min-w-[1.125rem]"
          )}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </div>
  );
}
