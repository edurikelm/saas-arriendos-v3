import { NextResponse } from "next/server";
import { registerAction } from "@/lib/actions/auth";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await registerAction(data);

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}