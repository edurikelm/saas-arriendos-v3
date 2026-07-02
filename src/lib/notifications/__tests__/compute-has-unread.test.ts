import { describe, expect, it } from "vitest";
import { computeHasUnread, type NotificationForUnread, type LastReadEntry } from "@/lib/notifications/compute-has-unread";

function notif(id: string, createdAt: Date): NotificationForUnread {
  return { id, createdAt };
}

function read(notificationId: string, lastReadAt: Date): LastReadEntry {
  return { notificationId, lastReadAt };
}

describe("computeHasUnread", () => {
  it("marks notification as unread when never read", () => {
    const notifications = [notif("n1", new Date("2026-05-20"))];
    const lastRead: LastReadEntry[] = [];

    const result = computeHasUnread(notifications, lastRead);
    expect(result.has("n1")).toBe(true);
  });

  it("marks notification as read when lastReadAt is after createdAt", () => {
    const notifications = [notif("n1", new Date("2026-05-20"))];
    const lastRead = [read("n1", new Date("2026-05-21"))];

    const result = computeHasUnread(notifications, lastRead);
    expect(result.has("n1")).toBe(false);
  });

  it("marks notification as unread when createdAt is after lastReadAt", () => {
    const notifications = [notif("n1", new Date("2026-05-22"))];
    const lastRead = [read("n1", new Date("2026-05-20"))];

    const result = computeHasUnread(notifications, lastRead);
    expect(result.has("n1")).toBe(true);
  });

  it("handles mix of read and unread notifications", () => {
    const notifications = [
      notif("n1", new Date("2026-05-20")),
      notif("n2", new Date("2026-05-21")),
      notif("n3", new Date("2026-05-22")),
    ];
    const lastRead = [
      read("n1", new Date("2026-05-21")), // n1 read after creation → read
      // n2 never read → unread
      read("n3", new Date("2026-05-20")), // n3 read before creation → unread
    ];

    const result = computeHasUnread(notifications, lastRead);
    expect(result.has("n1")).toBe(false);
    expect(result.has("n2")).toBe(true);
    expect(result.has("n3")).toBe(true);
  });

  it("accepts Map as lastReadByNotification", () => {
    const notifications = [notif("n1", new Date("2026-05-20"))];
    const lastReadMap = new Map<string, LastReadEntry>([
      ["n1", read("n1", new Date("2026-05-21"))],
    ]);

    const result = computeHasUnread(notifications, lastReadMap);
    expect(result.has("n1")).toBe(false);
  });

  it("returns empty set when all notifications are read", () => {
    const notifications = [
      notif("n1", new Date("2026-05-20")),
      notif("n2", new Date("2026-05-21")),
    ];
    const lastRead = [
      read("n1", new Date("2026-05-22")),
      read("n2", new Date("2026-05-22")),
    ];

    const result = computeHasUnread(notifications, lastRead);
    expect(result.size).toBe(0);
  });

  it("returns all as unread when no reads provided", () => {
    const notifications = [
      notif("n1", new Date("2026-05-20")),
      notif("n2", new Date("2026-05-21")),
    ];
    const lastRead: LastReadEntry[] = [];

    const result = computeHasUnread(notifications, lastRead);
    expect(result.has("n1")).toBe(true);
    expect(result.has("n2")).toBe(true);
  });
});
