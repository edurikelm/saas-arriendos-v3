"use client";

import { useState, useCallback } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { NotificationList } from "./notification-list";
import {
  isNotificationSoundEnabled,
  playNotificationSound,
  setNotificationSoundEnabled,
} from "@/lib/notifications/notification-sound";
import { markAllNotificationsAsRead, getRecentNotifications, type RecentNotification } from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  unreadCount: number;
  /**
   * Increments when a new notification arrives. Each change swings the bell
   * and pops the badge (remounting them via `key` replays the animation);
   * 0 means nothing has arrived since the page loaded.
   */
  ringKey?: number;
  initialNotifications?: RecentNotification[];
  onNotificationsRead?: () => void;
}

export function NotificationBell({
  unreadCount,
  ringKey = 0,
  initialNotifications,
  onNotificationsRead,
}: NotificationBellProps) {
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
            aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"}
            className="rounded-lg relative inline-flex items-center justify-center"
          />
        }
      >
        <span
          key={`icon-${ringKey}`}
          data-testid="notification-bell-icon"
          className={cn("inline-flex", ringKey > 0 && "notification-bell-ring")}
        >
          <Bell className="h-5 w-5" />
        </span>
        {unreadCount > 0 && (
          <span
            key={`badge-${ringKey}`}
            aria-label={`${unreadCount} notificaciones sin leer`}
            aria-live="polite"
            className={cn(
              "absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full",
              "bg-destructive px-1 py-0.5 text-xs font-bold text-destructive-foreground",
              "min-w-[1.125rem] min-h-[1.125rem]",
              unreadCount > 99 ? "px-1" : "min-w-[1.125rem]",
              ringKey > 0 && "notification-badge-pop"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[calc(100vw-2rem)] sm:w-80 max-w-sm gap-0 p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border py-1.5 pl-3 pr-1.5">
          <PopoverTitle className="text-sm font-semibold">Notificaciones</PopoverTitle>
          <NotificationSoundToggle />
        </div>
        <NotificationList
          initialNotifications={notifications}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Mutes or unmutes the notification sound on this device. Unmuting plays it
 * once: a preview, and being a click it also unlocks audio in browsers that
 * require a gesture.
 */
function NotificationSoundToggle() {
  // Popover content only mounts on the client when opened, so reading
  // localStorage in the initializer cannot cause a hydration mismatch.
  const [enabled, setEnabled] = useState(isNotificationSoundEnabled);

  const toggle = () => {
    const next = !enabled;
    setNotificationSoundEnabled(next);
    setEnabled(next);
    if (next) playNotificationSound();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label="Silenciar sonido de notificaciones"
      aria-pressed={!enabled}
      title={enabled ? "Silenciar sonido" : "Activar sonido"}
      className="text-muted-foreground hover:text-foreground"
    >
      {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </Button>
  );
}
