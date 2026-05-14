import { getMercadoPagoToken } from "@/lib/actions/mercado-pago";
import { prisma } from "@/lib/db/prisma";
import { addDays } from "date-fns";
import { encrypt, decrypt } from "@/lib/crypto";
import { IntegrationProvider } from "@prisma/client";

export interface PaymentEvent {
  paymentId: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  reservationId?: string;
  amount?: number;
}

export interface PaymentLinkResult {
  initPoint: string;
  sandboxInitPoint?: string;
  expiresAt: Date;
  paymentId: string;
}

export interface PaymentGateway {
  createPaymentLink(reservationId: string, amount?: number): Promise<PaymentLinkResult>;
  getPaymentStatus(paymentId: string): Promise<string | null>;
  handleWebhook(rawPayload: unknown): Promise<PaymentEvent>;
}

function mapMercadoPagoStatus(status: string): PaymentEvent["status"] {
  switch (status) {
    case "approved":
    case "accredited":
      return "COMPLETED";
    case "pending":
      return "PENDING";
    case "cancelled":
    case "rejected":
    case "refunded":
    case "charged_back":
      return "FAILED";
    default:
      return "PENDING";
  }
}

export class MercadoPagoGateway implements PaymentGateway {
  private userId: string;
  private accessToken: string | null;

  constructor(userId: string, accessToken: string | null) {
    this.userId = userId;
    this.accessToken = accessToken;
  }

  private getToken(): string {
    return this.accessToken ?? process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
  }

  async createPaymentLink(
    reservationId: string,
    amount?: number
  ): Promise<PaymentLinkResult> {
    const reservation = await prisma.reservation.findFirst({
      where: { id: reservationId, userId: this.userId },
      include: { client: true, property: true },
    });

    if (!reservation) {
      throw new Error("Reservation not found");
    }

    const existingPayments = await prisma.payment.findMany({
      where: {
        reservationId,
        status: { in: ["COMPLETED", "PENDING"] },
        deletedAt: null,
      },
    });

    const totalPaid = existingPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );
    const pendingAmount = Number(reservation.totalPrice) - totalPaid;
    const paymentAmount = amount ?? pendingAmount;

    if (paymentAmount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    const externalReference = `${reservation.id}:${Date.now()}`;
    const description = `Reserva ${reservation.property.name} - ${reservation.client.name} (pago parcial)`;

    const response = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.getToken()}`,
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
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Mercado Pago error: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    const expirationDate = addDays(new Date(), 7);

    const payment = await prisma.payment.create({
      data: {
        reservationId,
        amount: paymentAmount,
        method: "MERCADO_PAGO",
        status: "PENDING",
        mercadoPagoId: String(data.id),
        initPoint: data.init_point,
        expiresAt: expirationDate,
      },
    });

    return {
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
      expiresAt: expirationDate,
      paymentId: payment.id,
    };
  }

  async getPaymentStatus(paymentId: string): Promise<string | null> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment?.mercadoPagoId) return null;

    return payment.status;
  }

  async handleWebhook(rawPayload: unknown): Promise<PaymentEvent> {
    const payload = rawPayload as {
      id: string;
      status: string;
      external_reference?: string;
    };

    let payment = await prisma.payment.findFirst({
      where: { mercadoPagoId: String(payload.id) },
      include: { reservation: true },
    });

    if (!payment && payload.external_reference) {
      const parts = payload.external_reference.split(":");
      const reservationId = parts[0];
      const paymentIdFromRef = parts.length > 1 ? parts[1] : null;
      if (reservationId) {
        const isValidUUID = paymentIdFromRef && /^[a-f0-9]{20,}$/i.test(paymentIdFromRef);
        payment = await prisma.payment.findFirst({
          where: {
            reservationId,
            ...(isValidUUID ? { id: paymentIdFromRef } : {}),
            deletedAt: null,
          },
          orderBy: { createdAt: "asc" },
          include: { reservation: true },
        });
      }
    }

    if (!payment) {
      throw new Error("Payment not found");
    }

    const newStatus = mapMercadoPagoStatus(payload.status);

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus as "PENDING" | "COMPLETED" | "FAILED" },
    });

    if (newStatus === "COMPLETED") {
      const allPayments = await prisma.payment.findMany({
        where: {
          reservationId: payment.reservationId,
          status: { in: ["COMPLETED", "PENDING"] },
          deletedAt: null,
        },
      });

      const totalPaid = allPayments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );
      const reservation = payment.reservation;

      if (totalPaid >= Number(reservation.totalPrice)) {
        await prisma.reservation.update({
          where: { id: payment.reservationId },
          data: { status: "CONFIRMED" },
        });
      }
    }

    return {
      paymentId: String(payload.id),
      status: newStatus,
      reservationId: payment.reservationId,
      amount: Number(payment.amount),
    };
  }
}

const gatewayCache = new Map<string, MercadoPagoGateway>();

export async function getGateway(provider: "mercadopago" | "stripe" = "mercadopago"): Promise<PaymentGateway> {
  const session = await import("@/lib/actions/auth").then((m) => m.getSession());
  if (!session) {
    throw new Error("Not authenticated");
  }

  const cacheKey = `${provider}:${session.userId}`;

  if (gatewayCache.has(cacheKey)) {
    return gatewayCache.get(cacheKey)!;
  }

  if (provider === "mercadopago") {
    const token = await getMercadoPagoToken(session.userId);
    const gateway = new MercadoPagoGateway(session.userId, token);
    gatewayCache.set(cacheKey, gateway);
    return gateway;
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export function clearGatewayCache(): void {
  gatewayCache.clear();
}