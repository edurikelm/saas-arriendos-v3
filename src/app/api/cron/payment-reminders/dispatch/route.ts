import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { recordDomainEvent } from "@/lib/notifications/record-event";
import { selectRemindersForDispatch } from "@/lib/notifications/select-reminders-for-dispatch";
import type { ReminderPayment } from "@/lib/notifications/select-reminders-for-dispatch";
import { getDateKeyInTz, BUSINESS_TIME_ZONE } from "@/lib/domain/timezone";

export const maxDuration = 300; // 5 min (Vercel Pro)

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.REMINDERS_CRON_SECRET}`;
  if (!process.env.REMINDERS_CRON_SECRET || auth !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const startedAt = Date.now();
  const now = new Date();

  // 1. Fetch pending reservation payments with dueDate, reservation and owner data
  const paymentRows = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      paymentType: "RESERVATION",
      dueDate: { not: null },
      deletedAt: null,
      reservation: {
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    },
    select: {
      id: true,
      status: true,
      paymentType: true,
      dueDate: true,
      amount: true,
      reservation: {
        select: {
          id: true,
          status: true,
          userId: true,
          client: { select: { name: true } },
          property: { select: { name: true } },
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  // 2. Build alreadySentKeys from prior PAYMENT_REMINDER notifications
  const sentRows = await prisma.notification.findMany({
    where: { type: "PAYMENT_REMINDER" },
    select: { notificationKey: true },
  });
  const alreadySentKeys = new Set(sentRows.map((s) => s.notificationKey));

  // 3. Map to ReminderPayment shape and select candidates
  const reminderPayments: ReminderPayment[] = paymentRows.map((p) => ({
    id: p.id,
    status: p.status,
    paymentType: p.paymentType,
    dueDate: p.dueDate,
    reservation: {
      id: p.reservation.id,
      status: p.reservation.status,
      client: { name: p.reservation.client.name },
      property: { name: p.reservation.property.name },
    },
  }));

  const candidates = selectRemindersForDispatch(
    reminderPayments,
    now,
    BUSINESS_TIME_ZONE,
    alreadySentKeys,
  );

  // 4. Build a lookup map from paymentRows for fast access
  const paymentById = new Map(paymentRows.map((p) => [p.id, p]));

  // 5. Group candidates by ownerId for isolated per-owner dispatch
  const byOwner: Record<string, number> = {};
  const errors: string[] = [];
  let totalReminders = 0;

  for (const candidate of candidates) {
    const paymentRow = paymentById.get(candidate.paymentId);
    if (!paymentRow) continue;

    const ownerId = paymentRow.reservation.userId;
    const ownerEmail = paymentRow.reservation.user.email;
    const ownerName = paymentRow.reservation.user.name ?? undefined;
    const clientName = paymentRow.reservation.client.name;
    const amount = String(paymentRow.amount);
    const dueDate = paymentRow.dueDate
      ? getDateKeyInTz(paymentRow.dueDate, BUSINESS_TIME_ZONE)
      : undefined;

    try {
      await recordDomainEvent({
        type: "PAYMENT_REMINDER",
        paymentId: candidate.paymentId,
        milestone: candidate.milestone,
        ownerId,
        ownerEmail,
        ownerName,
        clientName,
        amount,
        dueDate,
        reservationId: candidate.reservationId,
      });
      totalReminders++;
      byOwner[ownerId] = (byOwner[ownerId] ?? 0) + 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`owner=${ownerId}: ${msg}`);
      // Continue processing other owners
    }
  }

  return NextResponse.json({
    ok: true,
    totalReminders,
    byOwner,
    errors: errors.length > 0 ? errors : undefined,
    durationMs: Date.now() - startedAt,
  });
}
