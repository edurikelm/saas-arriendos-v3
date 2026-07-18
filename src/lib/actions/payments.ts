"use server";

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { getMercadoPagoToken } from "@/lib/actions/mercado-pago";
import { getReservations } from "@/lib/actions/reservations";
import { paymentSchema, type PaymentInput } from "@/lib/validations/payment";
import { fileSchema } from "@/lib/validations/file";
import { uploadImage } from "@/lib/actions/cloudinary";
import { classifyCollectionAlerts, type CollectionAlertPayment } from "@/lib/alerts/collection-alerts";
import type { CollectionAlertsResult } from "@/lib/alerts/collection-alerts";
import { revalidatePath } from "next/cache";
import { addDays } from "date-fns";
import { ZodError } from "zod";
import { getReservationPaidAmount, getReservationPendingAmount, type PaymentLike } from "@/lib/payments/calculations";
import {
  sumCompletedPaymentsForOwner,
  sumPendingPaymentsForOwner,
  countPendingPaymentsForOwner,
  markPaymentCompleted,
  markPaymentStatus,
  revertPaymentToPending,
  getAllPaymentsForReservation,
  getActivePaymentsForReservation,
  getPaymentById,
  getPaymentByMercadoPagoId,
} from "@/lib/payments/queries";
import { confirmReservationIfPaid } from "@/lib/reservations/confirmation";
import { recordDomainEvent } from "@/lib/notifications/record-event";
import { daysFromNowInBusinessTz, startOfMonthInSantiago } from "@/lib/domain/timezone";

function buildMercadoPagoNotificationUrl(paymentId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return `${appUrl}/api/webhooks/mercadopago?source_news=webhooks&paymentId=${paymentId}`;
}

function buildMercadoPagoBackUrls(paymentId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const resultUrl = `${appUrl}/payment/result?paymentId=${paymentId}`;

  return {
    success: `${resultUrl}&status=success`,
    pending: `${resultUrl}&status=pending`,
    failure: `${resultUrl}&status=failure`,
  };
}

function getMercadoPagoInitPoint(data: { init_point?: string; sandbox_init_point?: string }) {
  return data.init_point;
}

export async function getPaymentsByReservation(reservationId: string) {
  const session = await getSession();
  if (!session) return [];

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, userId: session.userId },
  });

  if (!reservation) return [];

  const payments = await getAllPaymentsForReservation(reservationId, {
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
  propertyId?: string;
  paymentType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  const session = await getSession();
  if (!session) return { payments: [], total: 0, totalPages: 0 };

  const where: Prisma.PaymentWhereInput = {};

  if (filters?.reservationId) {
    const reservation = await prisma.reservation.findFirst({
      where: { id: filters.reservationId, userId: session.userId },
    });

    if (!reservation) return { payments: [], total: 0, totalPages: 0 };
    where.reservationId = filters.reservationId;
  }

  if (filters?.status && (filters.status === "PENDING" || filters.status === "COMPLETED" || filters.status === "FAILED")) {
    where.status = filters.status;
  }

  if (filters?.method && (filters.method === "MERCADO_PAGO" || filters.method === "CASH" || filters.method === "TRANSFER")) {
    where.method = filters.method;
  }

  if (filters?.paymentType && (filters.paymentType === "RESERVATION" || filters.paymentType === "EXTRA")) {
    where.paymentType = filters.paymentType;
  }

  if (filters?.dateFrom) {
    where.createdAt = { ...where.createdAt as object, gte: new Date(filters.dateFrom) };
  }

  if (filters?.dateTo) {
    where.createdAt = { ...where.createdAt as object, lte: new Date(filters.dateTo + "T23:59:59") };
  }

  // propertyId filter via reservation
  if (filters?.propertyId) {
    where.reservation = { ...(where.reservation as object) ?? {}, propertyId: filters.propertyId };
  }

  const page = filters?.page ?? 1;
  const limit = filters?.limit ?? 20;
  const skip = (page - 1) * limit;

  const [payments, total, totalsByReservation] = await Promise.all([
    prisma.payment.findMany({
      where: { ...where, deletedAt: null },
      include: {
        reservation: {
          select: {
            id: true,
            totalPrice: true,
            billingType: true,
            property: {
              select: { id: true, name: true },
            },
            client: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where: { ...where, deletedAt: null } }),
    prisma.payment.groupBy({
      by: ["reservationId"],
      where: {
        installmentIndex: { not: null },
        deletedAt: null,
        reservation: { userId: session.userId },
        ...(filters?.reservationId ? { reservationId: filters.reservationId } : {}),
      },
      _max: { installmentIndex: true },
    }),
  ]);

  const totalMap = new Map(
    totalsByReservation.map((r) => [r.reservationId, r._max.installmentIndex ?? 0])
  );

  const totalPages = Math.ceil(total / limit);
  const today = new Date();

  return {
    payments: payments.map((p) => {
      const isPending = p.status === "PENDING";
      // daysFromNowInBusinessTz returns negative for past dates; negate so overdueDays is positive
      const rawDays = isPending && p.dueDate ? daysFromNowInBusinessTz(p.dueDate, today) : null;
      const overdueDays: number | null = rawDays !== null ? -rawDays : null;

      const isMonthly = p.reservation.billingType === "MONTHLY";
      const totalInstallments = totalMap.get(p.reservationId) ?? null;
      const installmentLabel: string | null =
        isMonthly && p.installmentIndex != null && totalInstallments != null && totalInstallments > 0
          ? `${p.installmentIndex} / ${totalInstallments}`
          : null;

      return {
        ...p,
        amount: String(p.amount),
        overdueDays,
        installmentLabel,
        createdAt: p.createdAt ? p.createdAt.toISOString() : null,
        clientName: p.reservation.client?.name ?? null,
        propertyName: p.reservation.property?.name ?? null,
        dueDate: p.dueDate ? p.dueDate.toISOString() : null,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
        deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
        reservation: {
          ...p.reservation,
          totalPrice: String(p.reservation.totalPrice),
        },
      };
    }),
    total,
    totalPages,
  };
}

export async function createPayment(data: unknown) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  let validated: PaymentInput;

  if (data instanceof FormData) {
    const reservationId = data.get("reservationId") as string;
    const amount = Number(data.get("amount"));
    const method = data.get("method") as string;
    const status = data.get("status") as string;
    const paidAtStr = data.get("paidAt") as string | null;
    const receipt = data.get("receipt") as File | null;
    const paymentType = data.get("paymentType") as string | null;
    const title = data.get("title") as string | null;
    const description = data.get("description") as string | null;

    let receiptUrl: string | undefined;
    if (receipt && receipt.size > 0) {
      const fileValidation = fileSchema.safeParse({
        size: receipt.size,
        type: receipt.type,
      });
      if (!fileValidation.success) {
        return {
          error: fileValidation.error.errors.map(e => e.message).join(", "),
        };
      }

      receiptUrl = await uploadImage(receipt, "rentalpro/receipts");
    }

    try {
      validated = paymentSchema.parse({
        reservationId,
        amount,
        method,
        status: status ?? "COMPLETED",
        paidAt: paidAtStr || undefined,
        receiptUrl: receiptUrl || undefined,
        paymentType: paymentType || undefined,
        title: title || undefined,
        description: description || undefined,
      });
    } catch (e) {
      if (e instanceof ZodError) {
        return { error: "Datos inválidos", details: e.errors };
      }
      return { error: "Datos inválidos" };
    }
  } else {
    try {
      validated = paymentSchema.parse(data);
    } catch (e) {
      if (e instanceof ZodError) {
        return { error: "Datos inválidos", details: e.errors };
      }
      return { error: "Datos inválidos" };
    }
  }

  const reservation = await prisma.reservation.findFirst({
    where: { id: validated.reservationId, userId: session.userId },
  });

  if (!reservation) {
    return { error: "Reserva no encontrada" };
  }

  if (reservation.status === "CANCELLED") {
    return { error: "No se pueden agregar pagos a una reserva cancelada" };
  }

  if (validated.paymentType !== "EXTRA") {
    const existingPayments = await getActivePaymentsForReservation(
      validated.reservationId,
    );

    const totalPaid = getReservationPaidAmount(existingPayments as unknown as PaymentLike[]);
    const newTotal = totalPaid + validated.amount;

    if (newTotal > Number(reservation.totalPrice)) {
      return {
        error: `El monto excede el total de la reserva. Total: ${Number(reservation.totalPrice).toLocaleString("CLP")}, ya pagado: ${totalPaid.toLocaleString("CLP")}`,
      };
    }
  }

  const payment = await prisma.payment.create({
    data: {
      reservationId: validated.reservationId,
      paymentType: validated.paymentType ?? "RESERVATION",
      title: validated.title ?? null,
      description: validated.description ?? null,
      amount: validated.amount,
      method: validated.method,
      status: validated.status ?? "COMPLETED",
      initPoint: validated.initPoint,
      expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
      paidAt: validated.paidAt ? new Date(validated.paidAt) : null,
      receiptUrl: validated.receiptUrl,
    },
  });

  if (validated.status === "COMPLETED" && validated.paymentType !== "EXTRA") {
    await confirmReservationIfPaid(validated.reservationId);
  }

  revalidatePath("/reservations");
  revalidatePath(`/reservations/${validated.reservationId}`);

  return { success: true, payment: { ...payment, amount: String(payment.amount) } };
}

export async function generateMercadoPagoLink(reservationId: string, amount?: number, paymentType?: "RESERVATION" | "EXTRA", title?: string, description?: string) {
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

  const accessToken = await getMercadoPagoToken(session.userId);

  if (!accessToken) {
    return { error: "Conecta tu cuenta de Mercado Pago en Settings" };
  }

  console.log(`[MP GenerateLink] Generating MP link for reservation ${reservationId} - using user token`);

  const existingPayments = await getActivePaymentsForReservation(reservationId);

  const pendingAmount = getReservationPendingAmount(existingPayments as unknown as PaymentLike[], Number(reservation.totalPrice));
  const paymentAmount = amount ?? pendingAmount;

  if (paymentAmount <= 0) {
    return { error: "El monto debe ser mayor a cero" };
  }

  if (paymentType !== "EXTRA" && paymentAmount > pendingAmount) {
    return {
      error: `El monto excede el pendiente. Pendiente: ${pendingAmount.toLocaleString("CLP")}`,
    };
  }

  const mpDescription = title || `Reserva ${reservation.property.name} - ${reservation.client.name} (pago parcial)`;

  const expirationDate = addDays(new Date(), 7);

  const payment = await prisma.payment.create({
    data: {
      reservationId,
      paymentType: paymentType ?? "RESERVATION",
      title: title ?? null,
      description: description ?? null,
      amount: paymentAmount,
      method: "MERCADO_PAGO",
      status: "PENDING",
      mercadoPagoId: `temp_${Date.now()}`,
      initPoint: null,
      expiresAt: expirationDate,
    },
  });

  console.log(`[MP GenerateLink] Created payment record ${payment.id} for reservation ${reservationId}`);

  const externalReference = `${reservation.id}:${payment.id}:${Date.now()}`;

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
            title: mpDescription,
            description: mpDescription,
            quantity: 1,
            currency_id: "CLP",
            unit_price: paymentAmount,
          },
        ],
        external_reference: externalReference,
        notification_url: buildMercadoPagoNotificationUrl(payment.id),
        back_urls: buildMercadoPagoBackUrls(payment.id),
        auto_return: "approved",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[MP GenerateLink] API failed, deleting payment ${payment.id}:`, errorData);
      await prisma.payment.delete({ where: { id: payment.id } });
      return { error: `Mercado Pago error: ${errorData.message || response.statusText}` };
    }

    const data = await response.json();

    console.log(`[MP GenerateLink] API success. Updating payment ${payment.id} with preference_id=${data.id}`);

    const initPoint = getMercadoPagoInitPoint(data);

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        mercadoPagoId: String(data.id),
        initPoint,
      },
    });

    return {
      success: true,
      payment,
      initPoint,
      sandboxInitPoint: data.sandbox_init_point,
      expiresAt: expirationDate.toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[MP GenerateLink] Exception, deleting payment ${payment.id}:`, message);
    await prisma.payment.delete({ where: { id: payment.id } });
    return { error: `Error al generar link: ${message}` };
  }
}

/** Shape del payload de MP tal como llega del webhook/API (snake_case).
 *
 * Note on `mp_payment_id`: Mercado Pago's API returns this as int64, which
 * the JSON parser decodes as a JavaScript Number. We type it as `string | number`
 * to reflect the real shape; processMercadoPagoWebhook coerces to String at
 * the boundary (ADR-0026 decision 4) so the DB column (String?) is honored. */
export type WebhookMpMetadata = {
  status_detail?: string;
  payment_method_id?: string;
  payment_type?: string;
  installments?: number;
  transaction_amount?: number;
  net_received_amount?: number;
  fee_amount?: number;
  date_created?: string;
  mp_payment_id?: string | number;
  card_last_four?: string;
};

export async function processMercadoPagoWebhook(payload: {
  id: string;
  status: string;
  external_reference: string;
  preference_id?: string;
  date_approved?: string;
  hintedPaymentId?: string;
  receipt_url?: string;
  mpMetadata?: WebhookMpMetadata;
}) {
  const { id, status, external_reference, preference_id, date_approved, hintedPaymentId, receipt_url, mpMetadata } = payload;

  console.log(`[MP Webhook] Processing. ID: ${id}, Status: ${status}, ExternalRef: ${external_reference}, PreferenceID: ${preference_id}`);

  let payment: Prisma.PaymentGetPayload<{ include: { reservation: { include: { client: true } } } }> | null = null;
  const parts = external_reference ? external_reference.split(":") : [];
  const reservationIdFromRef = parts[0] || null;
  const paymentIdFromRef = parts.length > 1 ? parts[1] : null;
  const hasValidPaymentIdInRef = Boolean(paymentIdFromRef && /^[a-z0-9]{20,}$/i.test(paymentIdFromRef));

  if (hintedPaymentId) {
    payment = await getPaymentById(hintedPaymentId);
  }

  if (!payment && hasValidPaymentIdInRef) {
    payment = await getPaymentById(paymentIdFromRef!);

    if (payment && reservationIdFromRef && payment.reservationId !== reservationIdFromRef) {
      payment = null;
    }
  }

  if (!payment && preference_id) {
    payment = await getPaymentByMercadoPagoId(preference_id, { includeClient: true });

    if (payment && reservationIdFromRef && payment.reservationId !== reservationIdFromRef) {
      payment = null;
    }
  }

  if (!payment) {
    payment = await getPaymentByMercadoPagoId(id);

    if (payment && reservationIdFromRef && payment.reservationId !== reservationIdFromRef) {
      payment = null;
    }
  }

  if (!payment) {
    console.log(`[MP Webhook] Payment not found. ID: ${id}, externalRef: ${external_reference}`);
    return { error: "Pago no encontrado" };
  }

  console.log(`[MP Webhook] Updating payment ${payment.id} to status ${status}`);

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

  // Idempotencia: si status no cambió Y no hay metadata MP nueva, skip.
  // Excepción (ADR-0026): si ya es COMPLETED pero no tiene metadata MP poblada,
  // hay que seguir para poblarla.
  const hasNewMpMetadata = Boolean(mpMetadata && (
    mpMetadata.mp_payment_id || mpMetadata.card_last_four ||
    mpMetadata.status_detail || mpMetadata.payment_method_id
  ));
  if (payment.status === newStatus && !hasNewMpMetadata) {
    console.log(`[MP Webhook] Payment ${payment.id} already in status ${newStatus}, skipping duplicate webhook`);
    return { success: true, skipped: true };
  }

  // ADR-0026: si ya es COMPLETED con mpPaymentId, es idempotente (rama 1).
  // Este early-return evita la llamada a markPaymentCompleted cuando no es needed.
  if (payment.status === "COMPLETED" && payment.mpPaymentId) {
    return { success: true, skipped: true };
  }

  if (newStatus === "COMPLETED") {
    // Construir MpMetadata (DB field names) desde WebhookMpMetadata (API field names)
    // ADR-0026 decision 4: mpPaymentId stored as String. MP returns it as int64
    // (a JSON number), so we coerce defensively at the API boundary here even
    // though the route handler also coerces in getPaymentStatus. Belt and
    // braces — any future caller that bypasses the route handler still gets
    // a String before hitting Prisma.
    const dbMpMetadata = mpMetadata ? {
      mpPaymentId: mpMetadata.mp_payment_id != null ? String(mpMetadata.mp_payment_id) : undefined,
      mpStatusDetail: mpMetadata.status_detail,
      mpPaymentMethodId: mpMetadata.payment_method_id,
      mpPaymentType: mpMetadata.payment_type,
      mpCardLastFour: mpMetadata.card_last_four,
      mpInstallments: mpMetadata.installments,
      mpTransactionAmount: mpMetadata.transaction_amount,
      mpNetReceivedAmount: mpMetadata.net_received_amount,
      mpFeeAmount: mpMetadata.fee_amount,
      mpDateCreated: mpMetadata.date_created,
    } : undefined;

    await markPaymentCompleted(payment.id, {
      paidAt: date_approved ? new Date(date_approved) : new Date(),
      mercadoPagoId: id,
      receiptUrl: receipt_url ?? undefined,
      mpMetadata: dbMpMetadata,
    });

    await confirmReservationIfPaid(payment.reservationId);

    // Emit PAYMENT_RECEIVED notification post-commit
    try {
      const owner = await prisma.userProfile.findUnique({
        where: { id: payment.reservation.userId },
        select: { email: true, name: true },
      });
      if (owner) {
        await recordDomainEvent({
          type: "PAYMENT_RECEIVED",
          paymentId: payment.id,
          ownerId: payment.reservation.userId,
          ownerEmail: owner.email,
          ownerName: owner.name ?? undefined,
          clientName: payment.reservation.client.name,
          amount: String(payment.amount),
          method: "MERCADO_PAGO",
          reservationId: payment.reservationId,
        });
      }
    } catch (err) {
      console.error("[Notifications] PAYMENT_RECEIVED dispatch failed (webhook)", err);
    }
  } else {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus, mercadoPagoId: id, receiptUrl: receipt_url ?? undefined },
    });
  }

  return { success: true, status: newStatus };
}

export async function generatePaymentLink(paymentId: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const payment = await getPaymentById(paymentId, { includeProperty: true });

  if (!payment) return { error: "Pago no encontrado" };

  if (payment.reservation.userId !== session.userId) {
    return { error: "No autorizado" };
  }

  if (payment.status !== "PENDING") {
    return { error: `No se puede generar link para un pago con estado ${payment.status}` };
  }

  if (payment.method !== "MERCADO_PAGO") {
    return { error: "Solo pagos de Mercado Pago pueden generar links" };
  }

  const accessToken = await getMercadoPagoToken(session.userId);

  if (!accessToken) {
    return { error: "Conecta tu cuenta de Mercado Pago en Settings" };
  }

  const externalReference = `${payment.reservation.id}:${payment.id}:${Date.now()}`;
  const description = `Cuota - Reserva ${payment.reservation.property.name}`;

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
            unit_price: Number(payment.amount),
          },
        ],
        external_reference: externalReference,
        notification_url: buildMercadoPagoNotificationUrl(paymentId),
        back_urls: buildMercadoPagoBackUrls(paymentId),
        auto_return: "approved",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: `Mercado Pago error: ${errorData.message || response.statusText}` };
    }

    const data = await response.json();

    const expiresAtDate = addDays(new Date(), 7);

    const initPoint = getMercadoPagoInitPoint(data);

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        initPoint,
        expiresAt: expiresAtDate,
        mercadoPagoId: String(data.id),
      },
    });

    revalidatePath("/reservations");
    revalidatePath(`/reservations/${payment.reservationId}`);
    revalidatePath("/payments");

    return {
      success: true,
      initPoint,
      sandboxInitPoint: data.sandbox_init_point,
      expiresAt: expiresAtDate.toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Error al generar link: ${message}` };
  }
}

export async function regeneratePaymentLink(id: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const payment = await getPaymentById(id, { includeProperty: true });

  if (!payment) return { error: "Pago no encontrado" };

  if (payment.reservation.userId !== session.userId) {
    return { error: "No autorizado" };
  }

  if (payment.method !== "MERCADO_PAGO") {
    return { error: "Solo pagos de Mercado Pago pueden regenerar links" };
  }

  if (payment.initPoint && (!payment.expiresAt || new Date(payment.expiresAt) > new Date())) {
    return { error: "El link actual aún no ha expirado" };
  }

  const accessToken = await getMercadoPagoToken(session.userId);

  if (!accessToken) {
    return { error: "Conecta tu cuenta de Mercado Pago en Settings" };
  }

  const externalReference = `${payment.reservation.id}:${payment.id}:${Date.now()}`;
  const description = `Reserva ${payment.reservation.property.name} - ${payment.reservation.client.name} (pago parcial)`;

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
            unit_price: Number(payment.amount),
          },
        ],
        external_reference: externalReference,
        notification_url: buildMercadoPagoNotificationUrl(id),
        back_urls: buildMercadoPagoBackUrls(id),
        auto_return: "approved",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: `Mercado Pago error: ${errorData.message || response.statusText}` };
    }

    const data = await response.json();

    const expiresAtDate = data.expiration_date ? new Date(data.expiration_date) : addDays(new Date(), 7);

    const initPoint = getMercadoPagoInitPoint(data);

    await prisma.payment.update({
      where: { id },
      data: {
        initPoint,
        expiresAt: expiresAtDate,
        mercadoPagoId: data.id,
      },
    });

    revalidatePath("/reservations");
    revalidatePath(`/reservations/${payment.reservationId}`);

    return { success: true, initPoint, sandboxInitPoint: data.sandbox_init_point };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Error al regenerar link: ${message}` };
  }
}

export async function deletePayment(id: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const payment = await getPaymentById(id, { includeClient: false });

  if (!payment) return { error: "Pago no encontrado" };

  if (payment.reservation.userId !== session.userId) {
    return { error: "No autorizado" };
  }

  await prisma.payment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/reservations");
  revalidatePath(`/reservations/${payment.reservationId}`);
  revalidatePath("/payments");

  return { success: true };
}

export async function restorePayment(id: string) {
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

  // Distinguimos el caso "ya estaba restaurado" del "recién restaurado" para
  // que el caller (UI undo toast) pueda mostrar un mensaje honesto.
  const wasDeleted = payment.deletedAt !== null;

  await prisma.payment.update({
    where: { id },
    data: { deletedAt: null },
  });

  revalidatePath("/reservations");
  revalidatePath(`/reservations/${payment.reservationId}`);
  revalidatePath("/payments");

  return { success: true, restored: wasDeleted };
}

export async function updatePayment(id: string, data: { status: "COMPLETED" | "PENDING" }) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const payment = await getPaymentById(id);

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
    await confirmReservationIfPaid(payment.reservationId);
  }

  revalidatePath("/reservations");
  revalidatePath(`/reservations/${payment.reservationId}`);

  return { success: true, payment: { ...updated, amount: String(updated.amount) } };
}

export async function revertPayment(id: string): Promise<
  { success: true; payment: { id: string; amount: string; status: string; paidAt: Date | null; reservationId: string } } | { error: string }
> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const existing = await getPaymentById(id);

  if (!existing) return { error: "Pago no encontrado" };
  if (existing.reservation.userId !== session.userId) {
    return { error: "No autorizado" };
  }

  const updated = await prisma.payment.update({
    where: { id },
    data: { status: "PENDING", paidAt: null },
  });

  // Emit PAYMENT_REVERTED notification post-commit
  try {
    const owner = await prisma.userProfile.findUnique({
      where: { id: session.userId },
      select: { email: true, name: true },
    });
    await recordDomainEvent({
      type: "PAYMENT_REVERTED",
      paymentId: id,
      ownerId: session.userId,
      ownerEmail: owner?.email ?? session.email,
      ownerName: owner?.name ?? undefined,
      clientName: existing.reservation.client.name,
      amount: String(existing.amount),
      reservationId: existing.reservationId,
    });
  } catch (err) {
    console.error("[Notifications] PAYMENT_REVERTED dispatch failed", err);
  }

  revalidatePath("/reservations");
  revalidatePath("/payments");

  return { success: true, payment: { ...updated, amount: String(updated.amount) } };
}

export async function markPaymentAsPaid(
  paymentId: string,
  paidAt: Date,
  method: 'CASH' | 'TRANSFER',
  receiptUrl?: string
) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const payment = await getPaymentById(paymentId);

  if (!payment) return { error: "Pago no encontrado" };

  if (payment.reservation.userId !== session.userId) {
    return { error: "No autorizado" };
  }

  if (payment.status === "COMPLETED") {
    return { error: "El pago ya está completado" };
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'COMPLETED',
      paidAt,
      method,
      ...(receiptUrl && { receiptUrl }),
    },
  });

  await confirmReservationIfPaid(payment.reservationId);

  // Emit PAYMENT_RECEIVED notification post-commit
  try {
    const owner = await prisma.userProfile.findUnique({
      where: { id: payment.reservation.userId },
      select: { email: true, name: true },
    });
    if (owner) {
      await recordDomainEvent({
        type: "PAYMENT_RECEIVED",
        paymentId,
        ownerId: payment.reservation.userId,
        ownerEmail: owner.email,
        ownerName: owner.name ?? undefined,
        clientName: payment.reservation.client.name,
        amount: String(payment.amount),
        method,
        reservationId: payment.reservationId,
      });
    }
  } catch (err) {
    console.error("[Notifications] PAYMENT_RECEIVED dispatch failed (manual)", err);
  }

  revalidatePath('/reservations');
  revalidatePath(`/reservations/${payment.reservationId}`);
  revalidatePath("/payments");

  return { success: true };
}

export async function attachReceipt(paymentId: string, receiptUrl: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const payment = await getPaymentById(paymentId);

  if (!payment) return { error: "Pago no encontrado" };
  if (payment.reservation.userId !== session.userId) return { error: "No autorizado" };
  if (payment.status !== "COMPLETED") return { error: "Solo se puede adjuntar comprobante a pagos completados" };
  if (payment.receiptUrl) return { error: "El pago ya tiene un comprobante" };

  await prisma.payment.update({
    where: { id: paymentId },
    data: { receiptUrl },
  });

  revalidatePath("/reservations");
  revalidatePath(`/reservations/${payment.reservationId}`);
  revalidatePath("/payments");

  return { success: true };
}

async function getMercadoPagoPaymentInfo(mercadoPagoId: string, accessToken: string): Promise<{ status: string } | null> {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${mercadoPagoId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.ok) {
    const payment = await response.json();
    return { status: payment.status };
  }

  return null;
}

export async function confirmPayment(id: string) {
  return updatePayment(id, { status: "COMPLETED" });
}

export async function checkMercadoPagoPaymentStatus(paymentId: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const payment = await getPaymentById(paymentId);

  if (!payment) return { error: "Pago no encontrado" };

  if (payment.reservation.userId !== session.userId) {
    return { error: "No autorizado" };
  }

  if (payment.method !== "MERCADO_PAGO") {
    return { error: "Solo pagos de Mercado Pago pueden verificarse" };
  }

  if (!payment.mercadoPagoId) {
    return { error: "Este pago no tiene ID de Mercado Pago" };
  }

  const accessToken = await getMercadoPagoToken(payment.reservation.userId);

  if (!accessToken) {
    return { error: "Conecta tu cuenta de Mercado Pago en Settings" };
  }

  try {
    const paymentInfo = await getMercadoPagoPaymentInfo(payment.mercadoPagoId, accessToken);

    if (!paymentInfo) {
      return { error: "No se encontró información del pago en Mercado Pago. El cliente quizás aún no ha iniciado el pago." };
    }

    let newStatus: "PENDING" | "COMPLETED" | "FAILED" = "PENDING";
    switch (paymentInfo.status) {
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

    if (newStatus !== payment.status) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: newStatus,
          paidAt: newStatus === "COMPLETED" ? new Date() : undefined,
        },
      });

      if (newStatus === "COMPLETED") {
        await confirmReservationIfPaid(payment.reservationId);
      }

      revalidatePath("/reservations");
      revalidatePath(`/reservations/${payment.reservationId}`);
      revalidatePath("/payments");

      return { success: true, newStatus };
    }

    return { success: true, newStatus: payment.status, alreadyUpdated: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `Error al verificar pago: ${message}` };
  }
}

export async function getCollectionAlerts(): Promise<CollectionAlertsResult> {
  const session = await getSession();
  if (!session) return { vencidos: [], vencenHoy: [], proximos7Dias: [] };

  const reservationsResult = await getReservations({ limit: 1000 });

  type ReservationData = Awaited<ReturnType<typeof getReservations>> extends { data: infer T } ? T : never;

  const reservations: ReservationData = (reservationsResult as { data: ReservationData }).data;

  const payments: CollectionAlertPayment[] = reservations.flatMap((reservation) =>
    (reservation.payments ?? [])
      .filter((payment) => payment.status === "PENDING" && payment.paymentType === "RESERVATION")
      .map((payment) => ({
        id: payment.id,
        status: payment.status,
        paymentType: payment.paymentType ?? null,
        method: payment.method,
        amount: Number(payment.amount),
        dueDate: payment.dueDate ?? null,
        initPoint: payment.initPoint ?? null,
        expiresAt: payment.expiresAt ?? null,
        reservation: {
          id: reservation.id,
          status: reservation.status,
          client: { name: reservation.client?.name ?? "—" },
          property: { name: reservation.property?.name ?? "—" },
        },
      }))
  );

  return classifyCollectionAlerts(payments);
}

export interface PaymentsKpis {
  cobradoMes: number;
  pendiente: number;
  pendienteCount: number;
  proximos7DiasCount: number;
}

export async function getPaymentsKpis(): Promise<PaymentsKpis> {
  const session = await getSession();
  if (!session) return { cobradoMes: 0, pendiente: 0, pendienteCount: 0, proximos7DiasCount: 0 };

  const startOfMonth = startOfMonthInSantiago();

  const [cobradoMes, pendiente, pendienteCount, alerts] = await Promise.all([
    sumCompletedPaymentsForOwner(session.userId, {
      from: new Date(startOfMonth),
    }),
    sumPendingPaymentsForOwner(session.userId),
    countPendingPaymentsForOwner(session.userId),
    getCollectionAlerts(),
  ]);

  return {
    cobradoMes,
    pendiente,
    pendienteCount,
    proximos7DiasCount: alerts.proximos7Dias.length,
  };
}
