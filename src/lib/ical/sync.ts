import { prisma } from "@/lib/db/prisma";
import { parseIcal } from "./parser";

export type SyncResult =
  | { ok: true; count: number }
  | { ok: false; error: string; kind: "FETCH_ERROR" | "PARSE_ERROR" | "NOT_FOUND" };

export async function syncExternalCalendarPipeline(
  externalCalendarId: string
): Promise<SyncResult> {
  // 1. Load ExternalCalendar with isActive: true
  const calendar = await prisma.externalCalendar.findUnique({
    where: { id: externalCalendarId },
  });

  if (!calendar) {
    return { ok: false, error: "Calendario no encontrado", kind: "NOT_FOUND" };
  }

  if (!calendar.isActive) {
    return { ok: false, error: "Calendario no está activo", kind: "NOT_FOUND" };
  }

  // 2. Fetch feed
  let text: string;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(calendar.feedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      await prisma.externalCalendar.update({
        where: { id: externalCalendarId },
        data: { lastSyncError: `HTTP ${response.status}: ${response.statusText}` },
      });
      return { ok: false, error: `Error HTTP ${response.status}`, kind: "FETCH_ERROR" };
    }

    const contentType = response.headers.get("content-type") ?? "";

    // If content-type is text/html, check if body actually contains iCal content
    if (contentType.includes("text/html")) {
      text = await response.text();
      if (!text.includes("BEGIN:VCALENDAR")) {
        await prisma.externalCalendar.update({
          where: { id: externalCalendarId },
          data: { lastSyncError: "El feed no contiene contenido iCal válido" },
        });
        return { ok: false, error: "El feed no contiene contenido iCal válido", kind: "FETCH_ERROR" };
      }
    } else {
      text = await response.text();
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error desconocido";
    await prisma.externalCalendar.update({
      where: { id: externalCalendarId },
      data: { lastSyncError: errorMessage },
    });
    return { ok: false, error: errorMessage, kind: "FETCH_ERROR" };
  }

  // 3. Parse iCal
  const parseResult = parseIcal(text);
  if (!parseResult.ok) {
    await prisma.externalCalendar.update({
      where: { id: externalCalendarId },
      data: { lastSyncError: parseResult.message },
    });
    return { ok: false, error: parseResult.message, kind: "PARSE_ERROR" };
  }

  // 4. Upsert by (externalCalendarId, externalUid)
  const existingBlocks = await prisma.externalChannelBlock.findMany({
    where: { externalCalendarId },
    select: { externalUid: true },
  });
  const existingUids = new Set(existingBlocks.map((b) => b.externalUid));
  const feedUids = new Set(parseResult.events.map((e) => e.uid));

  const now = new Date();

  // Upsert blocks from feed
  for (const event of parseResult.events) {
    await prisma.externalChannelBlock.upsert({
      where: {
        externalCalendarId_externalUid: {
          externalCalendarId,
          externalUid: event.uid,
        },
      },
      create: {
        externalCalendarId,
        propertyId: calendar.propertyId,
        externalUid: event.uid,
        startDate: event.startDate,
        endDate: event.endDate,
        summary: event.summary,
        status: "ACTIVE",
        lastSeenAt: now,
      },
      update: {
        startDate: event.startDate,
        endDate: event.endDate,
        summary: event.summary,
        status: "ACTIVE",
        lastSeenAt: now,
      },
    });
  }

  // Mark UIDs not in feed as INACTIVE (not deleted)
  for (const uid of existingUids) {
    if (!feedUids.has(uid)) {
      await prisma.externalChannelBlock.updateMany({
        where: { externalCalendarId, externalUid: uid, status: "ACTIVE" },
        data: { status: "INACTIVE" },
      });
    }
  }

  // 5. Update ExternalCalendar with sync stats
  const activeBlocksCount = await prisma.externalChannelBlock.count({
    where: { externalCalendarId, status: "ACTIVE" },
  });

  await prisma.externalCalendar.update({
    where: { id: externalCalendarId },
    data: {
      lastSyncedAt: now,
      lastSyncError: null,
      lastSyncCount: activeBlocksCount,
    },
  });

  return { ok: true, count: activeBlocksCount };
}
