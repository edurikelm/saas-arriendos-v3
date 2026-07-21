import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { syncExternalCalendarPipeline } from "@/lib/ical/sync";

export const maxDuration = 300; // 5 min (Vercel Pro)

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.ICAL_CRON_SECRET}`;
  if (!process.env.ICAL_CRON_SECRET || auth !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // ADR-0018 + Decisión 5 de ADR-0027: solo owners PRO sincronizan.
  // Calendarios de owners FREE quedan inactivos (no se borran).
  const calendars = await prisma.externalCalendar.findMany({
    where: { isActive: true, user: { plan: "PRO" } },
    include: { user: true },
  });

  const results = { synced: 0, failed: 0, errors: [] as string[] };

  for (const cal of calendars) {
    const result = await syncExternalCalendarPipeline(cal.id);
    if (result.ok) {
      results.synced++;
    } else {
      results.failed++;
      results.errors.push(result.error);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
