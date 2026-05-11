import { NextResponse } from "next/server";
import { getReservationById, updateReservation, cancelReservation, deleteReservation } from "@/lib/actions/reservations";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reservation = await getReservationById(id);

    if (!reservation) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error("Error fetching reservation:", error);
    return NextResponse.json({ error: "Error al obtener reserva" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    const result = await updateReservation(id, data);

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error updating reservation:", error);
    return NextResponse.json({ error: "Error al actualizar reserva" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const reason = searchParams.get("reason") || undefined;
    const permanent = searchParams.get("permanent") === "true";

    if (permanent) {
      const result = await deleteReservation(id);
      if (result?.error) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    const result = await cancelReservation(id, reason);

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    return NextResponse.json({ error: "Error al cancelar reserva" }, { status: 500 });
  }
}