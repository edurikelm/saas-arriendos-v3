/**
 * Pure helpers for the Import Calendars section.
 *
 * Extracted from the Client Component for testability. No DOM, no actions — just data shaping.
 */

import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export type SyncStatus = "ok" | "error" | "never" | "stale";

export type ImportCalendar = {
  id: string;
  name: string;
  channel: "AIRBNB" | "BOOKING_COM" | "VRBO" | "OTHER";
  feedUrl: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  lastSyncCount: number | null;
  createdAt: string;
};

// Cron runs daily at 06:00 UTC. We mark as stale after 26h to absorb timezone skew.
const STALE_THRESHOLD_MS = 26 * 60 * 60 * 1000;

/**
 * Determines the sync status of an external calendar for UI display.
 *
 *   - "ok"    → active, last sync was recent, no error
 *   - "error" → active but last sync failed (lastSyncError is set)
 *   - "never" → inactive, or active but never synced
 *   - "stale" → active, last sync succeeded but was too long ago
 *
 * The `now` parameter is injected for testability.
 */
export function getSyncStatus(calendar: ImportCalendar, now: Date = new Date()): SyncStatus {
  if (!calendar.isActive) return "never";
  if (calendar.lastSyncError) return "error";
  if (!calendar.lastSyncedAt) return "never";

  const ageMs = now.getTime() - new Date(calendar.lastSyncedAt).getTime();
  if (ageMs > STALE_THRESHOLD_MS) return "stale";
  return "ok";
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Nunca";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es });
  } catch {
    return "Nunca";
  }
}
