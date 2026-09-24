import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { syncExternalCalendarPipeline } from "@/lib/ical/sync";
import { resolveEffectivePlan } from "@/lib/subscriptions/effective-plan";

export const maxDuration = 300; // 5 min (Vercel Pro)

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.ICAL_CRON_SECRET}`;
  if (!process.env.ICAL_CRON_SECRET || auth !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // ADR-0018 + Decisión 5 de ADR-0027: solo owners con plan PRO sincronizan.
  // Calendarios de owners efectivamente FREE quedan inactivos, no se borran.
  // El plan es el EFECTIVO (ADR-0034: planOverride + subscription via
  // resolveEffectivePlan), no la columna UserProfile.plan — esa es solo
  // dato denormalizado para admin y se desincroniza de una concesión manual
  // o de una subscription recién vencida (#188).
  const calendars = await prisma.externalCalendar.findMany({
    where: { isActive: true },
    include: {
      user: {
        select: {
          planOverride: true,
          subscription: {
            select: { status: true, currentPeriodEnd: true, mpPreapprovalId: true },
          },
        },
      },
    },
  });

  // Filtrado en memoria: el volumen de calendarios activos es bajo, así que
  // derivar el plan efectivo por owner acá no es un problema de performance.
  const proCalendars = calendars.filter(
    (cal) => resolveEffectivePlan(cal.user.planOverride, cal.user.subscription) === "PRO",
  );

  const results = {
    synced: 0,
    failed: 0,
    skippedFree: calendars.length - proCalendars.length,
    errors: [] as string[],
  };

  for (const cal of proCalendars) {
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
