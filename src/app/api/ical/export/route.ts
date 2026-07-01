import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashExportToken, isValidTokenFormat } from "@/lib/ical/tokens";
import { buildExportEvents } from "@/lib/ical/export";
import { serializeIcal } from "@/lib/ical/serializer";
import type { ExternalChannel } from "@prisma/client";

const VALID_CHANNELS: ExternalChannel[] = ["AIRBNB", "BOOKING_COM", "VRBO", "OTHER"];

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 1. Read channel from query (required)
  const channelParam = searchParams.get("channel");
  if (!channelParam || !VALID_CHANNELS.includes(channelParam as ExternalChannel)) {
    return new NextResponse("Invalid token", { status: 401 });
  }
  const queryChannel = channelParam as ExternalChannel;

  // 2. Read token from Authorization header or query param
  const authHeader = request.headers.get("authorization");
  let rawToken: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    rawToken = authHeader.slice(7);
  } else {
    rawToken = searchParams.get("token");
  }

  if (!rawToken) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  // 3. Validate token format
  if (!isValidTokenFormat(rawToken)) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  // 4. Hash and lookup
  const tokenHash = hashExportToken(rawToken);
  const feed = await prisma.propertyExportFeed.findUnique({
    where: { tokenHash },
  });

  // 5. Check validity
  if (!feed || feed.isRevoked) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  // 6. Anti-oracle: channel must match
  if (feed.channel !== queryChannel) {
    return new NextResponse("Invalid token", { status: 401 });
  }

  // 7. Fetch property name for the calendar title
  const property = await prisma.property.findUnique({
    where: { id: feed.propertyId },
    select: { name: true },
  });

  // 8. Build events
  const events = await buildExportEvents(feed.propertyId, feed.channel);

  // 9. Serialize
  const icalText = serializeIcal({
    events,
    calendarName: property?.name ?? `RentalPro Property`,
  });

  // 9. Update lastFetchedAt (fire-and-forget)
  prisma.propertyExportFeed
    .update({
      where: { id: feed.id },
      data: { lastFetchedAt: new Date() },
    })
    .catch((err) => {
      console.error("Failed to update lastFetchedAt:", err);
    });

  // 10. Return response
  return new NextResponse(icalText, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="rentalpro-${feed.propertyId}-${feed.channel}.ics"`,
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Robots-Tag": "noindex",
    },
  });
}
