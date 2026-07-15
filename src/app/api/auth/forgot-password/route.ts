import { NextResponse } from "next/server";
import { requestPasswordResetAction } from "@/lib/actions/auth";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await requestPasswordResetAction(data);

    return NextResponse.json(result);
  } catch (error) {
    // Zod errors return as ZodError; expose a generic 400.
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 },
      );
    }
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
