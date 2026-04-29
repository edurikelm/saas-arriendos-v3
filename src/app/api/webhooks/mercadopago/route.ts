import { NextResponse } from "next/server";
import { processMercadoPagoWebhook } from "@/lib/actions/payments";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    if (!payload.id || !payload.status || !payload.external_reference) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    const result = await processMercadoPagoWebhook({
      id: payload.id,
      status: payload.status,
      external_reference: payload.external_reference,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Mercado Pago webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing error" },
      { status: 500 }
    );
  }
}