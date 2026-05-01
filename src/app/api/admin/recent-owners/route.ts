import { NextResponse } from "next/server";
import { getRecentOwners } from "@/lib/actions/super-admin";

export async function GET() {
  try {
    const owners = await getRecentOwners(5);

    return NextResponse.json({ owners });
  } catch (error) {
    console.error("Error fetching recent owners:", error);
    return NextResponse.json({ error: "Error al obtener propietarios" }, { status: 500 });
  }
}