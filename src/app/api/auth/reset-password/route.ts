import { NextResponse } from "next/server";
import { resetPasswordAction } from "@/lib/actions/auth";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const result = await resetPasswordAction(data);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 },
      );
    }
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
