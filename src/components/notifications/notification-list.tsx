"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { BellOff, Loader2 } from "lucide-react";
import { getRecentNotifications, markAllNotificationsAsRead, type RecentNotification } from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationListProps {
  initialNotifications?: RecentNotification[] | null;
}

export function NotificationList({ initialNotifications }: NotificationListProps) {
  const [notifications, setNotifications] = useState<RecentNotification[] | null>(
    initialNotifications ?? null
  );
  const [isPending, startTransition] = useTransition();

  // Sync when prop changes after mount (e.g., refresh from NotificationBell).
  // Effect depends on prop, NOT state — only fires when prop reference changes.
  useEffect(() => {
    if (initialNotifications !== undefined) {
      /* eslint-disable react-hooks/set-state-in-effect --
         Safe: simple replacement, no dependency on current state.
         Only runs when the prop reference changes (post-mount sync from NotificationBell). */
      setNotifications(initialNotifications);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [initialNotifications]);

  // Mount fetch only when no initial data was provided.
  useEffect(() => {
    if (initialNotifications !== undefined) return;
    let cancelled = false;
    void getRecentNotifications(10).then((list) => {
      if (!cancelled) setNotifications(list);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only on mount
  }, []);

  const handleMarkAll = () => {
    startTransition(async () => {
      const result = await markAllNotificationsAsRead();
      if ("success" in result && result.success) {
        setNotifications((prev) => (prev ?? []).map((n) => ({ ...n, isRead: true })));
      }
    });
  };

  if (notifications === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <BellOff className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No tienes notificaciones</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-[60vh] overflow-y-auto">
        {notifications.map((n) => (
          <NotificationRow key={n.id} {...n} />
        ))}
      </div>
      <div className="border-t border-border p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={handleMarkAll}
          disabled={isPending || notifications.every((n) => n.isRead)}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Marcar todas como leídas"}
        </Button>
      </div>
    </div>
  );
}

function NotificationRow({
  id: _id,
  title,
  body,
  link,
  type: _type,
  createdAt,
  isRead,
}: {
  id: string;
  title: string;
  body: string;
  link: string | null;
  type: string;
  createdAt: string;
  isRead: boolean;
}) {
  const isExternal = link?.startsWith("http") ?? false;
  const timeAgo = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    locale: es,
  });

  const content = (
    <div
      className={cn(
        "flex flex-col gap-1 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b border-border",
        !isRead && "bg-accent/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium line-clamp-1">{title}</p>
        {!isRead && (
          <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" aria-label="No leída" />
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-1">{body}</p>
      <p className="text-xs text-muted-foreground">{timeAgo}</p>
    </div>
  );

  if (!link) {
    return content;
  }

  if (isExternal) {
    return (
      <a href={link} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return (
    <Link href={link}>
      {content}
    </Link>
  );
}