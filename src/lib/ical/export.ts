import { prisma } from "@/lib/db/prisma";
import type { ExternalChannel } from "@prisma/client";

export type ExportEvent = {
  uid: string;
  startDate: Date;
  endDate: Date;
  summary?: string;
};

export type BuildExportEventsOptions = {
  propertyId: string;
  channel: ExternalChannel;
  windowStart?: Date;
  windowEnd?: Date;
};

/**
 * Builds export events for an iCal feed.
 *
 * Anti-eco rule: blocks from the SAME channel are excluded.
 * Reservations are ALWAYS included (domain-level).
 */
export async function buildExportEvents(
  propertyId: string,
  channel: ExternalChannel,
  windowStart?: Date,
  windowEnd?: Date
): Promise<ExportEvent[]> {
  const now = new Date();

  // Default window: -30 days to +18 months
  const effectiveWindowStart = windowStart ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const effectiveWindowEnd =
    windowEnd ??
    new Date(now.getTime() + 18 * 30 * 24 * 60 * 60 * 1000);

  // 1. Fetch reservations (always included, domain-level)
  // Only active statuses: PENDING, CONFIRMED, COMPLETED
  // Include monthly reservations (they affect availability)
  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
      endDate: { gte: effectiveWindowStart },
      startDate: { lte: effectiveWindowEnd },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      bookingAirbnb: true,
    },
  });

  const reservationEvents: ExportEvent[] = reservations.map((r) => ({
    uid: `res-${r.id}`,
    startDate: r.startDate,
    endDate: r.endDate,
    summary: "Reservado",
  }));

  // 2. Fetch blocks with anti-eco filter
  // Exclude blocks from the SAME channel
  // Include blocks from other channels (BOOKING_COM, VRBO, OTHER, or different AIRBNB source)
  const blocks = await prisma.externalChannelBlock.findMany({
    where: {
      propertyId,
      status: "ACTIVE",
      externalCalendar: {
        channel: { not: channel }, // Anti-eco: exclude same channel
      },
      endDate: { gte: effectiveWindowStart },
      startDate: { lte: effectiveWindowEnd },
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      summary: true,
    },
  });

  const blockEvents: ExportEvent[] = blocks.map((b) => ({
    uid: `block-${b.id}`,
    startDate: b.startDate,
    endDate: b.endDate,
    summary: b.summary ?? "Bloqueado",
  }));

  // Combine and return (sort by startDate for consistent output)
  const allEvents = [...reservationEvents, ...blockEvents];
  allEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return allEvents;
}
