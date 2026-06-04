import { NextResponse } from "next/server";
import { createPayment, getPayments } from "@/lib/actions/payments";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      reservationId: searchParams.get("reservationId") || undefined,
      status: searchParams.get("status") || undefined,
      method: searchParams.get("method") || undefined,
    };

    const payments = await getPayments(filters);
    return NextResponse.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json({ error: "Error al obtener pagos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const data = contentType.includes("multipart/form-data")
      ? await request.formData()
      : await request.json();
    const result = await createPayment(data);

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating payment:", error);
    return NextResponse.json({ error: "Error al crear pago" }, { status: 500 });
  }
}