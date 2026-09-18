import { NextResponse } from "next/server";
import { getBrokers, createBroker } from "@/lib/actions/brokers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || undefined;
    const onlyActive = searchParams.get("onlyActive") === "true";

    const result = await getBrokers({ page, limit, search, onlyActive });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching brokers:", error);
    return NextResponse.json({ error: "Error al obtener captadores" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await createBroker(data);

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating broker:", error);
    return NextResponse.json({ error: "Error al crear captador" }, { status: 500 });
  }
}
