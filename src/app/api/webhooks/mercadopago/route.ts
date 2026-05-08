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

async function getPaymentStatus(paymentId: string): Promise<{ status: string; external_reference?: string } | null> {
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
      return null;
    }

    const payment = await response.json();
    return {
      status: payment.status,
      external_reference: payment.external_reference,
    };
  } catch (error) {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const payload: MercadoPagoWebhookPayload = await request.json();

    if (!payload.action || !payload.data?.id) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const action = payload.action;
    const paymentId = payload.data.id;

    if (action.startsWith("payment.")) {
      const paymentInfo = await getPaymentStatus(paymentId);

      if (!paymentInfo) {
        return NextResponse.json({ error: "Could not fetch payment status" }, { status: 500 });
      }

      const result = await processMercadoPagoWebhook({
        id: paymentId,
        status: paymentInfo.status,
        external_reference: paymentInfo.external_reference || "",
      });

      return NextResponse.json({ received: true, result });
    }

    if (action.startsWith("merchant_order.")) {
      if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
        return NextResponse.json({ error: "No token configured" }, { status: 500 });
      }

      const merchantOrderId = payload.data.id;

      const response = await fetch(`https://api.mercadopago.com/merchant_orders/${merchantOrderId}`, {
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
          await processMercadoPagoWebhook({
            id: String(payment.id),
            status: payment.status,
            external_reference: merchantOrder.external_reference || "",
          });
        }
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: "Webhook processing error" }, { status: 500 });
  }
}