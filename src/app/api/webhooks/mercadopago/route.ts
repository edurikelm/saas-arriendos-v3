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

export function verifyMercadoPagoSignature(headers: Headers, rawBody: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("MERCADOPAGO_WEBHOOK_SECRET is not set. Webhook signature verification is disabled.");
    return true;
  }

  const signature = headers.get("x-signature") || headers.get("x-request-id");
  if (!signature) {
    console.error("Webhook request missing x-signature and x-request-id headers");
    return false;
  }

  const hmac = createHmac("sha256", secret);
  hmac.update(rawBody, "utf-8");
  const computedSignature = hmac.digest("hex");

  if (computedSignature !== signature) {
    console.error("Webhook signature mismatch");
    return false;
  }

  return true;
}

async function getPaymentStatus(paymentId: string, accessToken: string): Promise<{
  status: string;
  external_reference?: string;
  preference_id?: string;
  date_approved?: string;
} | null> {
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
      external_reference: payment.external_reference,
      preference_id: payment.preference_id,
      date_approved: payment.date_approved,
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

    if (!verifyMercadoPagoSignature(request.headers, rawBody)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload: MercadoPagoWebhookPayload;
    let paymentId: string;
    let action: string;

    const contentType = request.headers.get("content-type") || "";
    const url = new URL(request.url);

    if (contentType.includes("application/json") && url.searchParams.has("id")) {
      const id = url.searchParams.get("id");
      const topic = url.searchParams.get("topic");

      if (!id || !topic) {
        return NextResponse.json({ error: "Missing id or topic" }, { status: 400 });
      }

      action = topic;
      paymentId = id;
      console.log(`Mercado Pago webhook via query: topic=${topic}, id=${id}`);
    } else {
      payload = JSON.parse(rawBody);

      if (!payload.action || !payload.data?.id) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      action = payload.action;
      paymentId = payload.data.id;
      console.log(`Mercado Pago webhook via body: action=${action}, paymentId=${paymentId}`);
    }

    if (action === "payment" || action.startsWith("payment.")) {
      const { prisma } = await import("@/lib/db/prisma");
      const { getMercadoPagoToken } = await import("@/lib/actions/mercado-pago");

      let payment = await prisma.payment.findFirst({
        where: { mercadoPagoId: paymentId, deletedAt: null },
        include: { reservation: true },
      });

      let accessToken: string | null = null;

      if (payment) {
        const userId = payment.reservation.userId;
        accessToken = await getMercadoPagoToken(userId);

        if (!accessToken) {
          console.warn(`[MP Webhook] No Mercado Pago token for user ${userId}, skipping webhook for payment ${paymentId}`);
          return NextResponse.json({ received: true, warning: "No token configured for payment owner" });
        }
      } else {
        const tokenResult = await findTokenForPayment(paymentId);
        if (!tokenResult) {
          console.warn(`[MP Webhook] Could not determine owner for payment ${paymentId}. Attempted all active integrations.`);
          return NextResponse.json({ received: true, warning: "Could not find payment owner" });
        }
        accessToken = tokenResult.accessToken;
      }

      const paymentInfo = await getPaymentStatus(paymentId, accessToken);

      if (!paymentInfo) {
        console.error(`[MP Webhook] Failed to fetch payment ${paymentId} from MP`);
        return NextResponse.json({ received: true, warning: "Could not fetch payment status from MP" });
      }

      const result = await processMercadoPagoWebhook({
        id: paymentId,
        status: paymentInfo.status,
        external_reference: paymentInfo.external_reference || "",
        preference_id: paymentInfo.preference_id || "",
        date_approved: paymentInfo.date_approved,
      });

      console.log(`Processed payment webhook: ${paymentId}`, result);
      return NextResponse.json({ received: true, result });
    }

    if (action === "merchant_order" || action.startsWith("merchant_order.")) {
      const { prisma } = await import("@/lib/db/prisma");
      const { getMercadoPagoToken } = await import("@/lib/actions/mercado-pago");

      const tokenResult = await findTokenForPayment(paymentId);

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

          const dbPayment = await prisma.payment.findFirst({
            where: { mercadoPagoId: String(payment.id), deletedAt: null },
            include: { reservation: true },
          });

          if (dbPayment) {
            const ownerToken = await getMercadoPagoToken(dbPayment.reservation.userId);
            if (ownerToken) {
              paymentAccessToken = ownerToken;
            }
          }

          const paymentInfo = await getPaymentStatus(String(payment.id), paymentAccessToken);

          const result = await processMercadoPagoWebhook({
            id: String(payment.id),
            status: payment.status,
            external_reference: merchantOrder.external_reference || "",
            preference_id: String(payment.preference_id || ""),
            date_approved: paymentInfo?.date_approved,
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