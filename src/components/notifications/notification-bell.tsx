"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationList } from "./notification-list";
import { markAllNotificationsAsRead } from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  unreadCount: number;
}

export function NotificationBell({ unreadCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          // Auto-mark-as-read in background (non-blocking, best-effort)
          void markAllNotificationsAsRead().catch((err) => {
            console.error("[Notifications] auto-mark failed", err);
          });
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notificaciones"
            className="rounded-lg relative inline-flex items-center justify-center"
          />
        }
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} notificaciones sin leer`}
            className={cn(
              "absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full",
              "bg-destructive px-1 py-0.5 text-xs font-bold text-destructive-foreground",
              "min-w-[1.125rem] min-h-[1.125rem]",
              unreadCount > 99 ? "px-1" : "min-w-[1.125rem]"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm p-0"
      >
        <NotificationList />
      </PopoverContent>
    </Popover>
  );
}