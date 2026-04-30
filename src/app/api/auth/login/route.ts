import { NextResponse } from "next/server";
import { loginAction, getSession } from "@/lib/actions/auth";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await loginAction(data);

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const session = await getSession();
    return NextResponse.json({ success: true, role: session?.role });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}