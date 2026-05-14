import { NextResponse } from "next/server";
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

async function getPaymentStatus(paymentId: string): Promise<{ status: string; external_reference?: string; preference_id?: string } | null> {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return null;
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch payment ${paymentId}: ${response.statusText}`);
      return null;
    }

    const payment = await response.json();
    return {
      status: payment.status,
      external_reference: payment.external_reference,
      preference_id: payment.preference_id,
    };
  } catch (error) {
    console.error(`Error fetching payment ${paymentId}:`, error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
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
      payload = await request.json();

      if (!payload.action || !payload.data?.id) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      action = payload.action;
      paymentId = payload.data.id;
      console.log(`Mercado Pago webhook via body: action=${action}, paymentId=${paymentId}`);
    }

    if (action === "payment" || action.startsWith("payment.")) {
      const paymentInfo = await getPaymentStatus(paymentId);

      if (!paymentInfo) {
        return NextResponse.json({ error: "Could not fetch payment status" }, { status: 500 });
      }

      const result = await processMercadoPagoWebhook({
        id: paymentId,
        status: paymentInfo.status,
        external_reference: paymentInfo.external_reference || "",
        preference_id: paymentInfo.preference_id || "",
      });

      console.log(`Processed payment webhook: ${paymentId}`, result);
      return NextResponse.json({ received: true, result });
    }

    if (action === "merchant_order" || action.startsWith("merchant_order.")) {
      if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
        return NextResponse.json({ error: "No token configured" }, { status: 500 });
      }

      const response = await fetch(`https://api.mercadopago.com/merchant_orders/${paymentId}`, {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        },
      });

      if (!response.ok) {
        return NextResponse.json({ error: "Failed to fetch merchant order" }, { status: 500 });
      }

      const merchantOrder = await response.json();

      for (const payment of merchantOrder.payments || []) {
        if (payment.status === "approved") {
          const result = await processMercadoPagoWebhook({
            id: String(payment.id),
            status: payment.status,
            external_reference: merchantOrder.external_reference || "",
            preference_id: String(payment.preference_id || ""),
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