"use client";

import { useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationList } from "./notification-list";
import { markAllNotificationsAsRead, getRecentNotifications, type RecentNotification } from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  unreadCount: number;
  initialNotifications?: RecentNotification[];
  onNotificationsRead?: () => void;
}

export function NotificationBell({ unreadCount, initialNotifications, onNotificationsRead }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  // Local notification list: starts from initial data, updated after background refresh.
  // undefined means "no initial data yet" (triggers mount fetch in NotificationList).
  const [notifications, setNotifications] = useState<RecentNotification[] | undefined>(initialNotifications);

  const handleOpen = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) return;

    // Always show initialNotifications immediately (or existing state); then refresh in background.
    // Sequence: (1) background refresh resolves → update local list with fresh data.
    //          (2) if unreadCount > 0 → mark-as-read resolves → mark rows locally as read + callback.
    // This order avoids race: fresh data lands first, then read-status overlay on top.

    void (async () => {
      try {
        const fresh = await getRecentNotifications(10);
        setNotifications(fresh);

        if (unreadCount > 0) {
          const result = await markAllNotificationsAsRead();
          if ("success" in result && result.success) {
            // Apply read status on top of the fresh list.
            setNotifications((prev) =>
              (prev ?? fresh).map((n) => ({ ...n, isRead: true }))
            );
            onNotificationsRead?.();
          }
        }
      } catch (err) {
        console.error("[Notifications] refresh/mark failed", err);
      }
    })();
  }, [unreadCount, onNotificationsRead]);

  return (
    <Popover open={open} onOpenChange={handleOpen}>
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
            aria-live="polite"
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
        <NotificationList
          initialNotifications={notifications}
        />
      </PopoverContent>
    </Popover>
  );
}