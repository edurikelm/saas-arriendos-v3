"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { paymentSchema, type PaymentInput } from "@/lib/validations/payment";
import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";

export async function getPaymentsByReservation(reservationId: string) {
  const session = await getSession();
  if (!session) return [];

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, userId: session.userId },
  });

  if (!reservation) return [];

  const payments = await prisma.payment.findMany({
    where: { reservationId },
    orderBy: { createdAt: "desc" },
  });

  return payments;
}

export async function getPayments(filters?: {
  reservationId?: string;
  status?: string;
  method?: string;
}) {
  const session = await getSession();
  if (!session) return [];

  const where: any = {};

  if (filters?.reservationId) {
    const reservation = await prisma.reservation.findFirst({
      where: { id: filters.reservationId, userId: session.userId },
    });

    if (!reservation) return [];
    where.reservationId = filters.reservationId;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.method) {
    where.method = filters.method;
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      reservation: {
        select: {
          id: true,
          totalPrice: true,
          property: {
            select: { name: true },
          },
          client: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return payments;
}

export async function createPayment(data: PaymentInput) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const validated = paymentSchema.parse(data);

  const reservation = await prisma.reservation.findFirst({
    where: { id: validated.reservationId, userId: session.userId },
  });

  if (!reservation) {
    return { error: "Reserva no encontrada" };
  }

  if (reservation.status === "CANCELLED") {
    return { error: "No se pueden agregar pagos a una reserva cancelada" };
  }

  const existingPayments = await prisma.payment.findMany({
    where: {
      reservationId: validated.reservationId,
      status: "COMPLETED",
    },
  });

  const totalPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const newTotal = totalPaid + validated.amount;

  if (newTotal > Number(reservation.totalPrice)) {
    return {
      error: `El monto excede el total de la reserva. Total: ${Number(reservation.totalPrice).toLocaleString("CLP")}, ya pagado: ${totalPaid.toLocaleString("CLP")}`,
    };
  }

  const payment = await prisma.payment.create({
    data: {
      reservationId: validated.reservationId,
      amount: validated.amount,
      method: validated.method as any,
      status: "COMPLETED",
    },
  });

  revalidatePath("/reservations");
  revalidatePath(`/reservations/${validated.reservationId}`);

  return { success: true, payment };
}

export async function generateMercadoPagoLink(reservationId: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, userId: session.userId },
    include: {
      client: true,
      property: true,
    },
  });

  if (!reservation) return { error: "Reserva no encontrada" };

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return { error: "Mercado Pago no está configurado" };
  }

  const externalReference = reservation.id;
  const description = `Reserva ${reservation.property.name} - ${reservation.client.name}`;
  const amount = Number(reservation.totalPrice);

  try {
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: description,
            description,
            quantity: 1,
            currency_id: "CLP",
            unit_price: amount,
          },
        ],
        external_reference: externalReference,
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: `Mercado Pago error: ${errorData.message || response.statusText}` };
    }

    const data = await response.json();

    const payment = await prisma.payment.create({
      data: {
        reservationId,
        amount,
        method: "MERCADO_PAGO",
        status: "PENDING",
        mercadoPagoId: data.id,
      },
    });

    return {
      success: true,
      payment,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
    };
  } catch (error: any) {
    return { error: `Error al generar link: ${error.message}` };
  }
}

export async function processMercadoPagoWebhook(payload: {
  id: string;
  status: string;
  external_reference: string;
}) {
  const { id, status, external_reference } = payload;

  const payment = await prisma.payment.findFirst({
    where: { mercadoPagoId: id },
  });

  if (!payment) {
    return { error: "Pago no encontrado" };
  }

  let newStatus: "PENDING" | "COMPLETED" | "FAILED" = "PENDING";

  switch (status) {
    case "approved":
    case "accredited":
      newStatus = "COMPLETED";
      break;
    case "pending":
      newStatus = "PENDING";
      break;
    case "cancelled":
    case "rejected":
    case "refunded":
    case "charged_back":
      newStatus = "FAILED";
      break;
    default:
      newStatus = "PENDING";
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: newStatus },
  });

  return { success: true, status: newStatus };
}

export async function deletePayment(id: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const payment = await prisma.payment.findFirst({
    where: { id },
    include: {
      reservation: true,
    },
  });

  if (!payment) return { error: "Pago no encontrado" };

  if (payment.reservation.userId !== session.userId) {
    return { error: "No autorizado" };
  }

  await prisma.payment.delete({
    where: { id },
  });

  revalidatePath("/reservations");
  revalidatePath(`/reservations/${payment.reservationId}`);

  return { success: true };
}