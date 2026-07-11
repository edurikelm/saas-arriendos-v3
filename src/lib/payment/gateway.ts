import { getMercadoPagoToken } from "@/lib/actions/mercado-pago";
import { processMercadoPagoWebhook } from "@/lib/actions/payments";
import { prisma } from "@/lib/db/prisma";
import { addDays } from "date-fns";

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

function getMercadoPagoInitPoint(data: { init_point?: string; sandbox_init_point?: string }) {
  return data.init_point;
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
    if (!this.accessToken) {
      throw new Error("Mercado Pago access token not configured for this user. Connect your account in Settings.");
    }
    return this.accessToken;
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

    const expirationDate = addDays(new Date(), 7);

    const payment = await prisma.payment.create({
      data: {
        reservationId,
        amount: paymentAmount,
        method: "MERCADO_PAGO",
        status: "PENDING",
        mercadoPagoId: `temp_${Date.now()}`,
        initPoint: null,
        expiresAt: expirationDate,
      },
    });

    const externalReference = `${reservation.id}:${payment.id}:${Date.now()}`;
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
          notification_url: buildMercadoPagoNotificationUrl(payment.id),
          back_urls: buildMercadoPagoBackUrls(payment.id),
          auto_return: "approved",
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      await prisma.payment.delete({ where: { id: payment.id } });
      throw new Error(`Mercado Pago error: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();

    const initPoint = getMercadoPagoInitPoint(data);
    if (!initPoint) {
      await prisma.payment.delete({ where: { id: payment.id } });
      throw new Error("Mercado Pago error: missing checkout URL");
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        mercadoPagoId: String(data.id),
        initPoint,
      },
    });

    return {
      initPoint,
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
    const raw = rawPayload as Record<string, unknown>;

    const payload = {
      id: String(raw.id ?? ""),
      status: String(raw.status ?? ""),
      external_reference: String(raw.external_reference ?? ""),
      preference_id: raw.preference_id ? String(raw.preference_id) : undefined,
      receipt_url: raw.receipt_url ? String(raw.receipt_url) : undefined,
      date_approved: raw.date_approved ? String(raw.date_approved) : undefined,
    };

    const result = await processMercadoPagoWebhook(payload);

    if ("error" in result) {
      throw new Error(result.error);
    }

    const status = result.skipped
      ? mapMercadoPagoStatus(payload.status)
      : result.status as PaymentEvent["status"];

    return {
      paymentId: payload.id,
      status,
    };
  }
}

const gatewayCache = new Map<string, MercadoPagoGateway>();

export async function getGateway(provider: "mercadopago" | "stripe" = "mercadopago"): Promise<PaymentGateway> {
  const session = await import("@/lib/auth/session").then((m) => m.getSession());
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
