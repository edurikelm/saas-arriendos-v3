import { NextResponse } from "next/server";
import { getPaymentsByReservation } from "@/lib/actions/payments";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reservationId: string }> }
) {
  try {
    const { reservationId } = await params;
    const payments = await getPaymentsByReservation(reservationId);
    return NextResponse.json({ payments });
  } catch (error) {
    console.error("Error refreshing payments:", error);
    return NextResponse.json({ error: "Error al refrescar pagos" }, { status: 500 });
  }
}