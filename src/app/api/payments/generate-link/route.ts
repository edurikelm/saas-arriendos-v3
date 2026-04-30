import { NextResponse } from "next/server";
import { generateMercadoPagoLink } from "@/lib/actions/payments";

export async function POST(request: Request) {
  try {
    const { reservationId, amount } = await request.json();

    if (!reservationId) {
      return NextResponse.json({ error: "reservationId es requerido" }, { status: 400 });
    }

    const result = await generateMercadoPagoLink(reservationId, amount);

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error generating Mercado Pago link:", error);
    return NextResponse.json({ error: "Error al generar link de pago" }, { status: 500 });
  }
}