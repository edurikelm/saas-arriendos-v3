import { NextResponse } from "next/server";
import { getClients, createClient } from "@/lib/actions/clients";

export async function GET() {
  try {
    const clients = await getClients();
    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await createClient(data);

    if (result?.error) {
      const status = result.upgrade ? 403 : 400;
      return NextResponse.json({ error: result.error, upgrade: result.upgrade }, { status });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating client:", error);
    return NextResponse.json({ error: "Error al crear cliente" }, { status: 500 });
  }
}