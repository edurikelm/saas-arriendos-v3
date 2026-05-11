import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/actions/super-admin";

export async function GET() {
  try {
    const stats = await getDashboardStats();

    if (!stats) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
  }
}