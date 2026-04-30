import { NextResponse } from "next/server";
import { updateUserPlan, deleteUser, createOwner, getAllUsers, getUserStats } from "@/lib/actions/super-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || undefined;
    const plan = searchParams.get("plan") || undefined;
    const userId = searchParams.get("userId");

    if (userId) {
      const stats = await getUserStats(userId);
      if (!stats) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      return NextResponse.json(stats);
    }

    const result = await getAllUsers({ page, limit, search, plan });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    if (!data.email || !data.password || !data.name) {
      return NextResponse.json({ error: "Email, password y nombre son requeridos" }, { status: 400 });
    }

    const result = await createOwner({
      email: data.email,
      password: data.password,
      name: data.name,
      plan: data.plan || "FREE",
    });

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating owner:", error);
    return NextResponse.json({ error: "Error al crear propietario" }, { status: 500 });
  }
}

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