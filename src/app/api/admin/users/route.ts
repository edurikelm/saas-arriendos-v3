import { NextResponse } from "next/server";
import { updateUserPlan, deleteUser, createOwner, getAllUsers, getUserStats } from "@/lib/actions/super-admin";
import { getSession } from "@/lib/actions/auth";
import { prisma } from "@/lib/db/prisma";

async function logAdminAction(targetId: string, action: string, details?: object) {
  const session = await getSession();
  if (!session) return;
  await prisma.adminActionLog.create({
    data: {
      adminId: session.userId,
      targetId,
      action,
      details: details ? JSON.stringify(details) : null,
    },
  });
}

async function isSuperAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  const user = await prisma.userProfile.findUnique({
    where: { id: session.userId },
  });

  return user?.role === "SUPER_ADMIN";
}

export async function GET(request: Request) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

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
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

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

    if (result?.user) {
      await logAdminAction(result.user.id, "CREATED", { email: data.email, name: data.name, plan: data.plan });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating owner:", error);
    return NextResponse.json({ error: "Error al crear propietario" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const data = await request.json();

    if (!data.userId || !data.plan) {
      return NextResponse.json({ error: "userId y plan son requeridos" }, { status: 400 });
    }

    const result = await updateUserPlan({ userId: data.userId, plan: data.plan });

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    if (result?.user) {
      await logAdminAction(data.userId, "UPDATED", { plan: data.plan });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating user plan:", error);
    return NextResponse.json({ error: "Error al actualizar plan" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

    await logAdminAction(userId, "DELETED", {});
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