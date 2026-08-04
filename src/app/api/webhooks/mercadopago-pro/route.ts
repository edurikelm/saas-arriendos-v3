import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { applySubscriptionEvent } from "@/lib/subscriptions/lifecycle";
import { normalizeDataId } from "@/lib/payment/webhook-helpers";
import { getSubscriptionByPreapprovalId } from "@/lib/subscriptions/queries";
import { getProGateway } from "@/lib/payment/pro-gateway";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface MpSubscriptionWebhookPayload {
  id?: number | string;
  live_mode?: boolean;
  type?: string;
  date_created?: string;
  user_id?: number;
  api_version?: string;
  action?: string;
  data?: { id: string };
}

// ──────────────────────────────────────────────────────────────────────────────
// Signature verification
// ──────────────────────────────────────────────────────────────────────────────

function parseSignatureHeader(
  signatureHeader: string,
): { ts: string | null; v1: string | null } {
  const parts = signatureHeader.split(",").map((p) => p.trim());
  const ts = parts.find((p) => p.startsWith("ts="))?.slice(3) ?? null;
  const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3) ?? null;
  return { ts, v1 };
}

function getWebhookDataId(requestUrl: string, rawBody: string): string | null {
  const url = new URL(requestUrl);
  const queryDataId =
    url.searchParams.get("data.id") || url.searchParams.get("id");
  if (queryDataId) return queryDataId;

  try {
    const parsed = JSON.parse(rawBody) as MpSubscriptionWebhookPayload;
    return parsed.data?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Verifica la firma del webhook de Mercado Pago PRO.
 *
 * El manifest sigue el formato:
 *   id:{dataId};request-id:{requestId};ts:{ts};
 *
 * Esta función es exportada públicamente para facilitar tests directos.
 */
export function verifyMpProWebhookSignature(
  headers: Headers,
  rawBody: string,
  requestUrl: string,
): boolean {
  const secret = process.env.MERCADOPAGO_PRO_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "MERCADOPAGO_PRO_WEBHOOK_SECRET is not set. Webhook signature verification is disabled for non-production environments.",
      );
      return true;
    }
    console.error(
      "MERCADOPAGO_PRO_WEBHOOK_SECRET is not set in production",
    );
    return false;
  }

  const signatureHeader = headers.get("x-signature");
  const requestId = headers.get("x-request-id");

  if (!signatureHeader || !requestId) {
    console.error(
      "Webhook request missing x-signature or x-request-id header",
    );
    return false;
  }

  const { ts, v1 } = parseSignatureHeader(signatureHeader);
  if (!ts || !v1) {
    console.error("Webhook request has invalid x-signature format");
    return false;
  }

  const dataId = getWebhookDataId(requestUrl, rawBody);
  if (!dataId) {
    console.error(
      "Webhook request missing data.id in query params or payload",
    );
    return false;
  }

  const manifest = `id:${normalizeDataId(dataId)};request-id:${requestId};ts:${ts};`;
  const hmac = createHmac("sha256", secret);
  hmac.update(manifest, "utf-8");
  const computed = hmac.digest("hex");

  if (computed !== v1) {
    console.error(
      `[MP Pro Webhook] Signature mismatch. dataId=${dataId}, requestId=${requestId}, ts=${ts}`,
    );
    return false;
  }

  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// Webhook event parsing
// ──────────────────────────────────────────────────────────────────────────────

function parseWebhookEvent(
  rawBody: string,
  requestUrl: string,
): { topic: string; resourceId: string } | { error: string } {
  const url = new URL(requestUrl);
  const queryId =
    url.searchParams.get("data.id") || url.searchParams.get("id");
  const queryTopic =
    url.searchParams.get("topic") || url.searchParams.get("type");

  if (queryId && queryTopic) {
    return { topic: queryTopic, resourceId: queryId };
  }

  try {
    const payload = JSON.parse(rawBody) as MpSubscriptionWebhookPayload;
    if (!payload.action || !payload.data?.id) {
      return { error: "Invalid payload" };
    }
    // action viene como "preapproval.created" o "authorized_payment.created"
    const topic = payload.action.split(".")[0];
    return { topic, resourceId: payload.data.id };
  } catch {
    return { error: "Invalid payload" };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Status → event type mapping
// ──────────────────────────────────────────────────────────────────────────────

function mapMpStatusToEventType(
  status: string,
): "authorized" | "paused" | "cancelled" | "payment_failed" | null {
  switch (status) {
    case "authorized":
      return "authorized";
    case "paused":
      return "paused";
    case "cancelled":
      return "cancelled";
    case "pending":
      return null; // no transitiona — aún no autorizado
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Handlers por topic
// ──────────────────────────────────────────────────────────────────────────────

async function handlePreapprovalWebhook(
  preapprovalId: string,
): Promise<NextResponse> {
  // 1. Buscar la subscription local por mpPreapprovalId
  const subscription = await getSubscriptionByPreapprovalId(preapprovalId);
  if (!subscription) {
    console.warn(
      `[MP Pro Webhook] No subscription found for preapproval ${preapprovalId}`,
    );
    return NextResponse.json({
      received: true,
      warning: "Subscription not found",
    });
  }

  // 2. Obtener el estado actual del preapproval desde MP
  const info = await getProGateway().fetchPreapproval(preapprovalId);

  // 3. Mapear status MP → tipo de evento interno
  const eventType = mapMpStatusToEventType(info.status);
  if (!eventType) {
    return NextResponse.json({
      received: true,
      warning: `Unhandled status: ${info.status}`,
    });
  }

  // 4. Aplicar evento via lifecycle (idempotente automáticamente)
  await applySubscriptionEvent({
    type: eventType,
    subscriptionId: subscription.id,
    payload: {
      source: "webhook",
      mpStatus: info.status,
      startDate: info.startDate,
      endDate: info.endDate,
      nextPaymentDate: info.nextPaymentDate,
    },
  });

  return NextResponse.json({ received: true, subscriptionId: subscription.id });
}

async function handleAuthorizedPaymentWebhook(
  paymentId: string,
): Promise<NextResponse> {
  // Para authorized_payment, MP envía el ID del payment individual.
  // La correlación fina con preapprovalId depende de que MP exponga
  // esa info en el payload — actualmente no siempre la incluye.
  //
  // Estrategia MVP: buscar cualquier subscription AUTHORIZED del owner
  // y marcarla como renovada. En MVP hay 1 subscription por owner.
  // TODO futuro: cuando MP exponga preapproval_id, mejorar la correlación.

  const { prisma } = await import("@/lib/db/prisma");

  const subscription = await prisma.subscription.findFirst({
    where: { status: "AUTHORIZED" },
  });

  if (!subscription) {
    return NextResponse.json({
      received: true,
      warning: "No authorized subscription",
    });
  }

  await applySubscriptionEvent({
    type: "renewed",
    subscriptionId: subscription.id,
    payload: { source: "webhook", mpPaymentId: paymentId },
  });

  return NextResponse.json({ received: true });
}

// ──────────────────────────────────────────────────────────────────────────────
// POST handler
// ──────────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    if (
      !verifyMpProWebhookSignature(request.headers, rawBody, request.url)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const event = parseWebhookEvent(rawBody, request.url);
    if ("error" in event) {
      return NextResponse.json({ error: event.error }, { status: 400 });
    }

    const { topic, resourceId } = event;
    console.log(
      `[MP Pro Webhook] topic=${topic}, resourceId=${resourceId}`,
    );

    // Topic: preapproval — cambios de estado de la suscripción
    if (topic === "preapproval") {
      return await handlePreapprovalWebhook(resourceId);
    }

    // Topic: authorized_payment — cobro recurrente exitoso o fallido
    if (topic === "authorized_payment") {
      return await handleAuthorizedPaymentWebhook(resourceId);
    }

    // Otros topics: ignorar (el webhook existente maneja payment/merchant_order)
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("MP Pro webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing error" },
      { status: 500 },
    );
  }
}
