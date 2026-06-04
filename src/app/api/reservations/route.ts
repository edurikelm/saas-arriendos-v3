import { NextResponse } from "next/server";
import { getReservations } from "@/lib/actions/reservations";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || undefined;
    const propertyId = searchParams.get("propertyId") || undefined;
    const status = searchParams.get("status") || undefined;
    const billingType = searchParams.get("billingType") || undefined;

    const result = await getReservations({ page, limit, search, propertyId, status, billingType });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching reservations:", error);
    return NextResponse.json({ error: "Error al obtener reservas" }, { status: 500 });
  }
}
