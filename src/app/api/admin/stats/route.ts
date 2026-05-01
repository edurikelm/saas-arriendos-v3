import { NextResponse } from "next/server";
import { getSystemStats } from "@/lib/actions/super-admin";

export async function GET() {
  try {
    const stats = await getSystemStats();

    if (!stats) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching system stats:", error);
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
  }
}