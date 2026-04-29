import { NextResponse } from "next/server";
import { deletePayment } from "@/lib/actions/payments";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await deletePayment(id);

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error deleting payment:", error);
    return NextResponse.json({ error: "Error al eliminar pago" }, { status: 500 });
  }
}