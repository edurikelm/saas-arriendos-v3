import { NextResponse } from "next/server";
import { loginAction } from "@/lib/actions/auth";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await loginAction(data);

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}