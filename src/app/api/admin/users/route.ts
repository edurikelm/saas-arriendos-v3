import { NextResponse } from "next/server";
import { updateUserPlan, deleteUser } from "@/lib/actions/super-admin";

export async function PATCH(request: Request) {
  try {
    const data = await request.json();

    if (!data.userId || !data.plan) {
      return NextResponse.json({ error: "userId y plan son requeridos" }, { status: 400 });
    }

    const result = await updateUserPlan({ userId: data.userId, plan: data.plan });

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating user plan:", error);
    return NextResponse.json({ error: "Error al actualizar plan" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

    const result = await deleteUser(userId);

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Error al eliminar usuario" }, { status: 500 });
  }
}