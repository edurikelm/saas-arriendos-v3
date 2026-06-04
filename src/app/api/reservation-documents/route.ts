import { NextResponse } from "next/server";
import { createReservationDocument, listReservationDocuments } from "@/lib/actions/reservation-documents";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reservationId = searchParams.get("reservationId");
    if (!reservationId) {
      return NextResponse.json({ error: "reservationId requerido" }, { status: 400 });
    }

    const result = await listReservationDocuments(reservationId);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al listar documentos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const reservationId = String(formData.get("reservationId") || "");
    const category = String(formData.get("category") || "");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    const result = await createReservationDocument({
      reservationId,
      category: category as "CONTRATO" | "ANEXO" | "INVENTARIO" | "OTRO",
      file,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al crear documento" }, { status: 500 });
  }
}
