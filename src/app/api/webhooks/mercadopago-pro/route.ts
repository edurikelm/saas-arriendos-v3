import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { addDays, addMonths } from "date-fns";
import { applySubscriptionEvent } from "@/lib/subscriptions/lifecycle";
import { normalizeDataId, WEBHOOK_TIMESTAMP_TOLERANCE_MS } from "@/lib/payment/webhook-helpers";
import {
  getSubscriptionByPreapprovalId,
  hasSubscriptionEventForAuthorizedPayment,
} from "@/lib/subscriptions/queries";
import { getProGateway } from "@/lib/payment/pro-gateway";
import { revalidateAfterPlanChange } from "@/lib/subscriptions/revalidate-plan";
import { PRO_PRICING } from "@/lib/subscriptions/pricing";

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

  // Timestamp tolerance check — prevents replay attacks
  const toleranceMs =
    Number(process.env.MERCADOPAGO_PRO_WEBHOOK_TIMESTAMP_TOLERANCE_MS) ||
    WEBHOOK_TIMESTAMP_TOLERANCE_MS;
  const tsMs = parseInt(ts, 10) * 1000; // Convert seconds (Unix ts) to ms
  const nowMs = Date.now();
  if (
    Number.isFinite(tsMs) &&
    Math.abs(nowMs - tsMs) > toleranceMs
  ) {
    console.warn(
      `[MP Pro Webhook] Signature rejected: ts ${ts} is outside tolerance window`,
    );
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
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(manifest, "utf-8");
  const computed = hmac.digest("hex");

  if (
    computed.length !== v1.length ||
    !crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(v1))
  ) {
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
  const { planChange } = await applySubscriptionEvent({
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
  revalidateAfterPlanChange(planChange);

  return NextResponse.json({ received: true, subscriptionId: subscription.id });
}

async function handleAuthorizedPaymentWebhook(
  authorizedPaymentId: string,
): Promise<NextResponse> {
  // Para authorized_payment, MP solo envía el ID del cobro individual —
  // hay que consultar MP para saber a qué preapproval pertenece y si el
  // payment asociado fue aprobado o rechazado.
  const info = await getProGateway().fetchAuthorizedPayment(authorizedPaymentId);

  if (!info.preapprovalId) {
    return NextResponse.json({
      received: true,
      warning: "Authorized payment without preapproval",
    });
  }

  // Correlacionar por el preapproval del cobro, NO "cualquier" subscription
  // AUTHORIZED (#190): con 2+ owners PRO, el cobro de uno podía renovar la
  // suscripción de otro.
  const subscription = await getSubscriptionByPreapprovalId(info.preapprovalId);
  if (!subscription) {
    console.warn(
      `[MP Pro Webhook] No subscription found for authorized_payment preapproval ${info.preapprovalId}`,
    );
    return NextResponse.json({
      received: true,
      warning: "Subscription not found",
    });
  }

  if (info.paymentStatus === "approved") {
    const startDate = info.debitDate ?? info.dateCreated;

    // Solo una subscription que sigue AUTHORIZED se renueva. Un "approved"
    // tardío sobre una subscription que ya no lo está (EXPIRED, CANCELLED...)
    // se registra como "payment_unapplied" para reconciliación — reactivarla
    // automáticamente por un cobro atrasado es una decisión de producto
    // pendiente, tracked como follow-up de #190, no un fix de correlación.
    if (subscription.status !== "AUTHORIZED") {
      const alreadyRecorded = await hasSubscriptionEventForAuthorizedPayment(
        subscription.id,
        "payment_unapplied",
        "mpAuthorizedPaymentId",
        authorizedPaymentId,
      );
      if (!alreadyRecorded) {
        // En PENDING es esperable: el primer cobro puede llegar antes que el
        // webhook `preapproval` que la autoriza (y fija el período). Solo los
        // demás estados merecen alarma.
        const log = subscription.status === "PENDING" ? console.warn : console.error;
        log(
          "[MP Pro Webhook] Approved charge on non-authorized subscription",
          {
            subscriptionId: subscription.id,
            status: subscription.status,
            authorizedPaymentId,
            paymentId: info.paymentId,
          },
        );
        await applySubscriptionEvent({
          type: "payment_unapplied",
          subscriptionId: subscription.id,
          payload: {
            source: "webhook",
            mpAuthorizedPaymentId: authorizedPaymentId,
            mpPaymentId: info.paymentId,
            subscriptionStatus: subscription.status,
            debitDate: info.debitDate,
          },
        });
      }
      return NextResponse.json({
        received: true,
        warning: `Subscription not authorized: ${subscription.status}`,
      });
    }

    // Idempotencia: MP puede reenviar el mismo authorized_payment ya
    // aprobado — no reaplicar "renewed" dos veces por el mismo cobro.
    // Entregas concurrentes de este mismo webhook son inofensivas SOLO
    // porque start/end abajo son fechas absolutas (de MP o derivadas de
    // startDate) — nunca se derivan de currentPeriodEnd, que sí cambiaría
    // entre una entrega y otra.
    const alreadyRenewed = await hasSubscriptionEventForAuthorizedPayment(
      subscription.id,
      "renewed",
      "mpAuthorizedPaymentId",
      authorizedPaymentId,
    );
    if (alreadyRenewed) {
      return NextResponse.json({
        received: true,
        subscriptionId: subscription.id,
        duplicate: true,
      });
    }

    // Se pide el preapproval fresco para tomar next_payment_date como fin del
    // período recién pagado — misma convención que createPreapproval (ver
    // pro-gateway.ts). startDate se pasa explícito porque, sin él, el lifecycle
    // usaría currentPeriodEnd como fallback: un reintento de esta misma
    // entrega correría el inicio al fin que ya movió la primera aplicación.
    const preapproval = await getProGateway().fetchPreapproval(info.preapprovalId);

    // MP puede no haber avanzado next_payment_date todavía cuando llega este
    // webhook (o directamente no incluirlo). Usarlo igual dejaría el período
    // ya vencido, expired_check lo bajaría de PRO el mismo día, y el dedupe
    // de arriba bloquearía que un reintento posterior lo corrigiera. Por eso
    // solo se usa si es una fecha futura respecto al cobro que se aplica;
    // si no, se deriva sumando un mes de plan al débito.
    //
    // "Futura" no alcanza: una fecha sin avanzar puede caer unas horas después
    // del débito (otra hora del mismo día) y el cron la expiraría igual. Una
    // fecha avanzada de verdad queda ~1 período después del débito, así que se
    // exige que supere al menos medio período.
    const startMs = startDate ? new Date(startDate).getTime() : NaN;
    const debitMs = Number.isFinite(startMs) ? startMs : Date.now();
    const referenceMs = Math.max(Date.now(), addDays(debitMs, 15).getTime());
    const candidateNextPaymentMs = preapproval.nextPaymentDate
      ? new Date(preapproval.nextPaymentDate).getTime()
      : NaN;
    const nextPaymentDateIsUsable =
      Number.isFinite(candidateNextPaymentMs) && candidateNextPaymentMs > referenceMs;

    let endDate = preapproval.nextPaymentDate;
    let nextPaymentDate = preapproval.nextPaymentDate;
    if (!nextPaymentDateIsUsable) {
      const fallback = addMonths(
        new Date(debitMs),
        PRO_PRICING.monthly.frequency,
      ).toISOString();
      console.warn(
        `[MP Pro Webhook] next_payment_date de MP no usable para preapproval ${info.preapprovalId} (stale o ausente) — usando fallback ${fallback}`,
      );
      endDate = fallback;
      nextPaymentDate = fallback;
    }

    const { planChange } = await applySubscriptionEvent({
      type: "renewed",
      subscriptionId: subscription.id,
      payload: {
        source: "webhook",
        mpAuthorizedPaymentId: authorizedPaymentId,
        mpPaymentId: info.paymentId,
        startDate,
        endDate,
        nextPaymentDate,
      },
    });
    revalidateAfterPlanChange(planChange);

    return NextResponse.json({ received: true, subscriptionId: subscription.id });
  }

  if (info.paymentStatus === "rejected") {
    // MP reintenta un cobro rechazado bajo el mismo authorized_payment id
    // pero con un payment id nuevo cada vez — dedupe por mpPaymentId, para
    // que cada rechazo real quede auditado y los reintentos no dupliquen.
    const alreadyRecorded = info.paymentId
      ? await hasSubscriptionEventForAuthorizedPayment(
          subscription.id,
          "payment_failed",
          "mpPaymentId",
          info.paymentId,
        )
      : false;
    if (alreadyRecorded) {
      return NextResponse.json({
        received: true,
        subscriptionId: subscription.id,
        duplicate: true,
      });
    }

    // "payment_failed" no cambia status ni plan (ver lifecycle.ts) — solo
    // queda como registro de auditoría.
    await applySubscriptionEvent({
      type: "payment_failed",
      subscriptionId: subscription.id,
      payload: {
        source: "webhook",
        mpAuthorizedPaymentId: authorizedPaymentId,
        mpPaymentId: info.paymentId,
        statusDetail: info.paymentStatusDetail,
      },
    });

    return NextResponse.json({ received: true, subscriptionId: subscription.id });
  }

  return NextResponse.json({
    received: true,
    subscriptionId: subscription.id,
    warning: `Unhandled payment status: ${info.paymentStatus ?? "none"}`,
  });
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
