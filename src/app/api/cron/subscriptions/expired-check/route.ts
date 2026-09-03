import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { applySubscriptionEvent } from "@/lib/subscriptions/lifecycle";
import { revalidateAfterPlanChange } from "@/lib/subscriptions/revalidate-plan";

export const maxDuration = 60; // 1 min (Vercel Pro)

const BATCH_SIZE = 50;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.SUBSCRIPTIONS_CRON_SECRET}`;

  if (!process.env.SUBSCRIPTIONS_CRON_SECRET || auth !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Buscar subscriptions cuyo período ya venció pero siguen AUTHORIZED o CANCELLED
  // ADR-0027 §3: cron EXPIRED_CHECK como fallback cuando MP no notifica
  const candidates = await prisma.subscription.findMany({
    where: {
      status: { in: ["AUTHORIZED", "CANCELLED"] },
      currentPeriodEnd: { lt: new Date() },
    },
    take: BATCH_SIZE,
    select: { id: true, status: true },
  });

  const results = {
    processed: 0,
    byStatus: { AUTHORIZED: 0, CANCELLED: 0 },
    errors: [] as string[],
  };

  // Una sola revalidacion al final del batch: el target es ("/", "layout"),
  // asi que invalidar por candidato seria el mismo trabajo repetido N veces.
  let downgraded = false;

  for (const sub of candidates) {
    try {
      const { planChange } = await applySubscriptionEvent({
        type: "expired_check",
        subscriptionId: sub.id,
        payload: { source: "cron", previousStatus: sub.status },
      });
      if (planChange && planChange.from !== planChange.to) {
        downgraded = true;
      }
      results.processed++;
      results.byStatus[sub.status as "AUTHORIZED" | "CANCELLED"]++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Cron EXPIRED_CHECK] Failed for subscription ${sub.id}:`, msg);
      results.errors.push(`${sub.id}: ${msg}`);
    }
  }

  if (downgraded) {
    revalidateAfterPlanChange({ from: "PRO", to: "FREE", source: "subscription_lifecycle" });
  }

  return NextResponse.json({ ok: true, ...results });
}
