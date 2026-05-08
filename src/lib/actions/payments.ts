"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { paymentSchema, type PaymentInput } from "@/lib/validations/payment";
import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";

export async function saveMercadoPagoToken(userId: string, accessToken: string) {
  if (!accessToken || typeof accessToken !== "string" || accessToken.trim().length === 0) {
    return { error: "El token de acceso es requerido" };
  }

  try {
    const response = await fetch("https://api.mercadopago.com/users/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || response.statusText;
      if (response.status === 401 || response.status === 403) {
        return { error: "Token de Mercado Pago inválido o revocada su acceso" };
      }
      return { error: `Error de Mercado Pago: ${message}` };
    }

    await prisma.userIntegration.upsert({
      where: {
        userId_provider: {
          userId,
          provider: "MERCADO_PAGO" as const,
        },
      },
      update: {
        accessToken: accessToken.trim(),
        isActive: true,
      },
      create: {
        userId,
        provider: "MERCADO_PAGO" as const,
        accessToken: accessToken.trim(),
        isActive: true,
      },
    });

    return { success: true };
  } catch (error: any) {
    return { error: `Error al validar token: ${error.message}` };
  }
}

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

  return payments.map((p) => ({
    ...p,
    amount: String(p.amount),
  }));
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

  return payments.map((p) => ({
    ...p,
    amount: String(p.amount),
    reservation: {
      ...p.reservation,
      totalPrice: String(p.reservation.totalPrice),
    },
  }));
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
      status: { in: ["COMPLETED", "PENDING"] },
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
      status: validated.status ?? "COMPLETED",
    },
  });

  if (validated.status === "COMPLETED" && newTotal >= Number(reservation.totalPrice)) {
    await prisma.reservation.update({
      where: { id: validated.reservationId },
      data: { status: "CONFIRMED" },
    });
  }

  revalidatePath("/reservations");
  revalidatePath(`/reservations/${validated.reservationId}`);

  return { success: true, payment };
}

export async function getMercadoPagoToken(userId: string): Promise<string | null> {
  const integration = await prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "MERCADO_PAGO" as const,
      },
    },
  });

  if (!integration || !integration.isActive) {
    return null;
  }

  return integration.accessToken;
}

export async function generateMercadoPagoLink(reservationId: string, amount?: number) {
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

  const userToken = await getMercadoPagoToken(session.userId);
  const accessToken = userToken ?? process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return { error: "Mercado Pago not configured. Please add your access token in Settings." };
  }

  const existingPayments = await prisma.payment.findMany({
    where: {
      reservationId,
      status: { in: ["COMPLETED", "PENDING"] },
    },
  });

  const totalPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = Number(reservation.totalPrice) - totalPaid;
  const paymentAmount = amount ?? pendingAmount;

  if (paymentAmount <= 0) {
    return { error: "El monto debe ser mayor a cero" };
  }

  if (paymentAmount > pendingAmount) {
    return {
      error: `El monto excede el pendiente. Pendiente: ${pendingAmount.toLocaleString("CLP")}`,
    };
  }

  const externalReference = `${reservation.id}:${Date.now()}`;
  const description = `Reserva ${reservation.property.name} - ${reservation.client.name} (pago parcial)`;

  try {
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: description,
            description,
            quantity: 1,
            currency_id: "CLP",
            unit_price: paymentAmount,
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
        amount: paymentAmount,
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

  // 1. Intentar buscar por mercadoPagoId (Payment ID de MP)
  let payment = await prisma.payment.findFirst({
    where: { mercadoPagoId: id },
    include: {
      reservation: true,
    },
  });

  // 2. FALLBACK: Si no encuentra, usar external_reference
  if (!payment && external_reference) {
    const reservationId = external_reference.split(":")[0];

    if (reservationId) {
      payment = await prisma.payment.findFirst({
        where: { reservationId },
        orderBy: { createdAt: "desc" },
        include: { reservation: true },
      });
    }
  }

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
    data: { 
      status: newStatus,
      mercadoPagoId: id
    },
  });

  if (newStatus === "COMPLETED") {
    const allPayments = await prisma.payment.findMany({
      where: {
        reservationId: payment.reservationId,
        status: { in: ["COMPLETED", "PENDING"] },
      },
    });

    const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const reservation = payment.reservation;

    if (totalPaid >= Number(reservation.totalPrice)) {
      await prisma.reservation.update({
        where: { id: payment.reservationId },
        data: { status: "CONFIRMED" },
      });
    }
  }

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

export async function updatePayment(id: string, data: { status: "COMPLETED" | "PENDING" }) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const payment = await prisma.payment.findFirst({
    where: { id },
    include: { reservation: true },
  });

  if (!payment) return { error: "Pago no encontrado" };

  if (payment.reservation.userId !== session.userId) {
    return { error: "No autorizado" };
  }

  if (payment.reservation.status === "CANCELLED") {
    return { error: "No se pueden modificar pagos de una reserva cancelada" };
  }

  if (payment.method === "MERCADO_PAGO") {
    return { error: "No se puede modificar un pago de Mercado Pago" };
  }

  const updated = await prisma.payment.update({
    where: { id },
    data: { status: data.status },
  });

  if (data.status === "COMPLETED") {
    const allPayments = await prisma.payment.findMany({
      where: {
        reservationId: payment.reservationId,
        status: { in: ["COMPLETED", "PENDING"] },
      },
    });

    const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    if (totalPaid >= Number(payment.reservation.totalPrice)) {
      await prisma.reservation.update({
        where: { id: payment.reservationId },
        data: { status: "CONFIRMED" },
      });
    }
  }

  revalidatePath("/reservations");
  revalidatePath(`/reservations/${payment.reservationId}`);

  return { success: true, payment: updated };
}