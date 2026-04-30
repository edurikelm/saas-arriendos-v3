import { NextResponse } from "next/server";
import { getProperties, createProperty, getUsedColors } from "@/lib/actions/properties";
import { propertySchema } from "@/lib/validations/property";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (type === "colors") {
      const colors = await getUsedColors();
      return NextResponse.json(colors);
    }

    const properties = await getProperties(type || undefined);
    return NextResponse.json(properties);
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json({ error: "Error al obtener propiedades" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const validated = propertySchema.parse(data);
    const result = await createProperty(validated);

    if (result?.error) {
      const status = result.upgrade ? 403 : 400;
      return NextResponse.json({ error: result.error, upgrade: result.upgrade }, { status });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Datos inválidos", details: error.errors }, { status: 400 });
    }
    console.error("Error creating property:", error);
    return NextResponse.json({ error: "Error al crear propiedad" }, { status: 500 });
  }
}