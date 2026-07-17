import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { processMercadoPagoWebhook } from "@/lib/actions/payments";

interface MercadoPagoWebhookPayload {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  user_id: number;
  api_version: string;
  action: string;
  data: {
    id: string;
  };
}

function getWebhookDataId(requestUrl: string, rawBody: string): string | null {
  const url = new URL(requestUrl);
  const queryDataId = url.searchParams.get("data.id") || url.searchParams.get("id");

  if (queryDataId) {
    return queryDataId;
  }

  try {
    const parsedBody = JSON.parse(rawBody) as Partial<MercadoPagoWebhookPayload>;
    return parsedBody.data?.id ?? null;
  } catch {
    return null;
  }
}

function parseWebhookEvent(rawBody: string, requestUrl: string): { action: string; paymentId: string; source: "query" | "body" } | { error: string } {
  const url = new URL(requestUrl);
  const queryPaymentId = url.searchParams.get("data.id") || url.searchParams.get("id");
  const queryAction = url.searchParams.get("topic") || url.searchParams.get("type");

  if (queryPaymentId && queryAction) {
    return { action: queryAction, paymentId: queryPaymentId, source: "query" };
  }

  try {
    const payload = JSON.parse(rawBody) as MercadoPagoWebhookPayload;

    if (!payload.action || !payload.data?.id) {
      return { error: "Invalid payload" };
    }

    return { action: payload.action, paymentId: payload.data.id, source: "body" };
  } catch {
    return { error: "Invalid payload" };
  }
}

function parseSignatureHeader(signatureHeader: string): { ts: string | null; v1: string | null } {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const ts = parts.find((part) => part.startsWith("ts="))?.slice(3) ?? null;
  const v1 = parts.find((part) => part.startsWith("v1="))?.slice(3) ?? null;

  return { ts, v1 };
}

function allowsInvalidWebhookSignatureInDevelopment() {
  return process.env.NODE_ENV !== "production" && process.env.MERCADOPAGO_WEBHOOK_ALLOW_INVALID_SIGNATURE === "true";
}

export function verifyMercadoPagoSignature(headers: Headers, rawBody: string, requestUrl: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("MERCADOPAGO_WEBHOOK_SECRET is not set. Webhook signature verification is disabled for non-production environments.");
      return true;
    }

    console.error("MERCADOPAGO_WEBHOOK_SECRET is not set in production");
    return false;
  }

  const signatureHeader = headers.get("x-signature");
  const requestId = headers.get("x-request-id");

  if (!signatureHeader || !requestId) {
    console.error("Webhook request missing x-signature or x-request-id header");
    return false;
  }

  const { ts, v1 } = parseSignatureHeader(signatureHeader);

  if (!ts || !v1) {
    console.error("Webhook request has invalid x-signature format");
    return false;
  }

  const dataId = getWebhookDataId(requestUrl, rawBody);

  if (!dataId) {
    console.error("Webhook request missing data.id in query params or payload");
    return false;
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hmac = createHmac("sha256", secret);
  hmac.update(manifest, "utf-8");
  const computedSignature = hmac.digest("hex");

  if (computedSignature !== v1) {
    console.error(`[MP Webhook] Signature mismatch. dataId=${dataId}, requestId=${requestId}, ts=${ts}`);

    if (allowsInvalidWebhookSignatureInDevelopment()) {
      console.warn("[MP Webhook] Continuing despite invalid signature because MERCADOPAGO_WEBHOOK_ALLOW_INVALID_SIGNATURE=true in non-production.");
      return true;
    }

    return false;
  }

  return true;
}

export interface MpPaymentInfo {
  status: string;
  status_detail?: string;
  external_reference?: string;
  preference_id?: string;
  date_approved?: string;
  date_created?: string;
  payment_method_id?: string;
  payment_type?: string;
  installments?: number;
  transaction_amount?: number;
  net_received_amount?: number;
  fee_details?: Array<{ type: string; amount: number }>;
  card?: {
    last_four_digits?: string;
    first_six_digits?: string;
    cardholder?: { name?: string };
  };
  id?: string;
}

async function getPaymentStatus(paymentId: string, accessToken: string): Promise<MpPaymentInfo | null> {
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch payment ${paymentId}: ${response.status} ${response.statusText}`);
      return null;
    }

    const payment = await response.json();
    return {
      status: payment.status,
      status_detail: payment.status_detail,
      external_reference: payment.external_reference,
      preference_id: payment.preference_id,
      date_approved: payment.date_approved,
      date_created: payment.date_created,
      payment_method_id: payment.payment_method_id,
      payment_type: payment.payment_type,
      installments: payment.installments,
      transaction_amount: payment.transaction_amount,
      net_received_amount: payment.net_received_amount,
      fee_details: payment.fee_details,
      card: payment.card,
      id: payment.id,
    };
  } catch (error) {
    console.error(`Error fetching payment ${paymentId}:`, error);
    return null;
  }
}

async function findTokenForPayment(paymentId: string): Promise<{ accessToken: string; userId: string } | null> {
  const { prisma } = await import("@/lib/db/prisma");
  const { getMercadoPagoToken } = await import("@/lib/actions/mercado-pago");

  const integrations = await prisma.userIntegration.findMany({
    where: { provider: "MERCADO_PAGO", isActive: true },
  });

  for (const integration of integrations) {
    const token = await getMercadoPagoToken(integration.userId);
    if (!token) continue;

    const paymentInfo = await getPaymentStatus(paymentId, token);
    if (paymentInfo) {
      return { accessToken: token, userId: integration.userId };
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    if (!verifyMercadoPagoSignature(request.headers, rawBody, request.url)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const hintedPaymentId = url.searchParams.get("paymentId");

    const event = parseWebhookEvent(rawBody, request.url);
    if ("error" in event) {
      return NextResponse.json({ error: event.error }, { status: 400 });
    }

    const { action, paymentId, source } = event;
    console.log(`Mercado Pago webhook via ${source}: action=${action}, paymentId=${paymentId}`);

      if (action === "payment" || action.startsWith("payment.")) {
      const { prisma } = await import("@/lib/db/prisma");
      const { getMercadoPagoToken } = await import("@/lib/actions/mercado-pago");
      const { getPaymentById, getPaymentByMercadoPagoId } = await import("@/lib/payments/queries");

      let payment = null;

      if (hintedPaymentId) {
        payment = await getPaymentById(hintedPaymentId, { includeClient: false });
      }

      if (!payment) {
        payment = await getPaymentByMercadoPagoId(paymentId);
      }

      let accessToken: string | null = null;

      if (payment) {
        const userId = payment.reservation.userId;
        accessToken = await getMercadoPagoToken(userId);

        if (!accessToken) {
          console.warn(`[MP Webhook] No Mercado Pago token for user ${userId}, skipping webhook for payment ${paymentId}`);
          return NextResponse.json({ received: true, warning: "No token configured for payment owner" });
        }
      } else if (!hintedPaymentId) {
        const tokenResult = await findTokenForPayment(paymentId);
        if (!tokenResult) {
          console.warn(`[MP Webhook] Could not determine owner for payment ${paymentId}. Attempted all active integrations.`);
          return NextResponse.json({ received: true, warning: "Could not find payment owner" });
        }
        accessToken = tokenResult.accessToken;
      } else {
        console.warn(`[MP Webhook] Hint paymentId=${hintedPaymentId} did not resolve a local payment for notification ${paymentId}`);
        return NextResponse.json({ received: true, warning: "Could not resolve payment owner from hint" });
      }

      const paymentInfo = await getPaymentStatus(paymentId, accessToken);

      if (!paymentInfo) {
        console.error(`[MP Webhook] Failed to fetch payment ${paymentId} from MP`);
        return NextResponse.json({ received: true, warning: "Could not fetch payment status from MP" });
      }

      // Build mpMetadata from extended paymentInfo
      // fee_amount is computed as sum of fee_details[].amount
      const fee_amount = paymentInfo.fee_details?.reduce(
        (sum, f) => sum + (f.amount ?? 0), 0
      ) ?? undefined;

      const mpMetadata = {
        status_detail: paymentInfo.status_detail,
        payment_method_id: paymentInfo.payment_method_id,
        payment_type: paymentInfo.payment_type,
        installments: paymentInfo.installments,
        transaction_amount: paymentInfo.transaction_amount,
        net_received_amount: paymentInfo.net_received_amount,
        fee_amount,
        date_created: paymentInfo.date_created,
        mp_payment_id: paymentInfo.id,
        card_last_four: paymentInfo.card?.last_four_digits,
      };

      const result = await processMercadoPagoWebhook({
        id: paymentId,
        status: paymentInfo.status,
        external_reference: paymentInfo.external_reference || "",
        preference_id: paymentInfo.preference_id || "",
        date_approved: paymentInfo.date_approved,
        hintedPaymentId: hintedPaymentId || undefined,
        mpMetadata,
      });

      console.log(`Processed payment webhook: ${paymentId}`, result);
      return NextResponse.json({ received: true, result });
    }

    if (action === "merchant_order" || action.startsWith("merchant_order.")) {
      const { getMercadoPagoToken } = await import("@/lib/actions/mercado-pago");
      const { getPaymentByMercadoPagoId, getPaymentById } = await import("@/lib/payments/queries");

      let tokenResult: { accessToken: string; userId: string } | null = null;

      if (hintedPaymentId) {
        const hintedPayment = await getPaymentById(hintedPaymentId, {
          includeClient: false,
        });

        if (hintedPayment) {
          const ownerToken = await getMercadoPagoToken(hintedPayment.reservation.userId);
          if (!ownerToken) {
            console.warn(`[MP Webhook] No Mercado Pago token for hinted merchant_order payment owner ${hintedPayment.reservation.userId}`);
            return NextResponse.json({ received: true, warning: "No token configured for payment owner" });
          }

          tokenResult = { accessToken: ownerToken, userId: hintedPayment.reservation.userId };
        } else {
          console.warn(`[MP Webhook] Hint paymentId=${hintedPaymentId} did not resolve a local payment for merchant_order ${paymentId}`);
        }
      }

      tokenResult ??= await findTokenForPayment(paymentId);

      if (!tokenResult) {
        console.warn(`[MP Webhook] No valid token found to fetch merchant_order ${paymentId}`);
        return NextResponse.json({ received: true, warning: "No token available to process merchant order" });
      }

      const response = await fetch(`https://api.mercadopago.com/merchant_orders/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch merchant_order ${paymentId}: ${response.status}`);
        return NextResponse.json({ received: true, warning: "Could not fetch merchant order" });
      }

      const merchantOrder = await response.json();

      for (const payment of merchantOrder.payments || []) {
        if (payment.status === "approved") {
          let paymentAccessToken = tokenResult.accessToken;

          const dbPayment = await getPaymentByMercadoPagoId(String(payment.id));

          if (dbPayment) {
            const ownerToken = await getMercadoPagoToken(dbPayment.reservation.userId);
            if (ownerToken) {
              paymentAccessToken = ownerToken;
            }
          }

          const paymentInfo = await getPaymentStatus(String(payment.id), paymentAccessToken);

          if (!paymentInfo) {
            console.warn(`[MP Webhook] merchant_order: failed to fetch payment ${payment.id} from MP`);
            continue;
          }

          // Build mpMetadata from extended paymentInfo (same as payment path)
          const fee_amount = paymentInfo.fee_details?.reduce(
            (sum, f) => sum + (f.amount ?? 0), 0
          ) ?? undefined;

          const mpMetadata = {
            status_detail: paymentInfo.status_detail,
            payment_method_id: paymentInfo.payment_method_id,
            payment_type: paymentInfo.payment_type,
            installments: paymentInfo.installments,
            transaction_amount: paymentInfo.transaction_amount,
            net_received_amount: paymentInfo.net_received_amount,
            fee_amount,
            date_created: paymentInfo.date_created,
            mp_payment_id: paymentInfo.id,
            card_last_four: paymentInfo.card?.last_four_digits,
          };

          const result = await processMercadoPagoWebhook({
            id: String(payment.id),
            status: payment.status,
            external_reference: merchantOrder.external_reference || "",
            preference_id: String(payment.preference_id || ""),
            date_approved: paymentInfo?.date_approved,
            hintedPaymentId: hintedPaymentId || undefined,
            mpMetadata,
          });

          console.log(`Processed merchant_order payment: ${payment.id}`, result);
        }
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Mercado Pago webhook error:", error);
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}
