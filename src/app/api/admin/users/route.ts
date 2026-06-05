import { NextResponse } from "next/server";
import { updateUserPlan, updateUserStatus, deleteUser, createOwner, getAllUsers, getUserStats } from "@/lib/actions/super-admin";
import { logAdminAction } from "@/lib/actions/admin-actions";
import { getSession } from "@/lib/actions/auth";
import { prisma } from "@/lib/db/prisma";

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
    const noProperties = searchParams.get("noProperties") === "true";
    const noReservations = searchParams.get("noReservations") === "true";
    const mpDisconnected = searchParams.get("mpDisconnected") === "true";
    const pendingPayments = searchParams.get("pendingPayments") === "true";
    const overduePayments = searchParams.get("overduePayments") === "true";
    const createdFrom = searchParams.get("createdFrom") || undefined;
    const createdTo = searchParams.get("createdTo") || undefined;
    const userId = searchParams.get("userId");

    if (userId) {
      const stats = await getUserStats(userId);
      if (!stats) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
      return NextResponse.json(stats);
    }

    const result = await getAllUsers({ page, limit, search, plan, noProperties, noReservations, mpDisconnected, pendingPayments, overduePayments, createdFrom, createdTo });
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
      await logAdminAction({
        targetId: result.user.id,
        action: "OWNER_CREATED",
        details: { email: data.email, name: data.name, plan: data.plan || "FREE" },
      });
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

    if (data.status) {
      if (!data.userId || !data.status) {
        return NextResponse.json({ error: "userId y status son requeridos" }, { status: 400 });
      }

      const validStatuses = ["ACTIVE", "SUSPENDED", "CANCELLED"];
      if (!validStatuses.includes(data.status)) {
        return NextResponse.json({ error: "Status inválido" }, { status: 400 });
      }

      const result = await updateUserStatus({ userId: data.userId, status: data.status });

      if (result?.error) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }

      return NextResponse.json(result);
    }

    if (!data.userId || !data.plan) {
      return NextResponse.json({ error: "userId y plan son requeridos" }, { status: 400 });
    }

    const oldUser = await prisma.userProfile.findUnique({
      where: { id: data.userId },
      select: { plan: true },
    });

    const result = await updateUserPlan({ userId: data.userId, plan: data.plan });

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    if (result?.user) {
      await logAdminAction({
        targetId: data.userId,
        action: "PLAN_CHANGED",
        details: {
          before: oldUser?.plan || "FREE",
          after: data.plan,
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const confirmEmail = searchParams.get("confirmEmail") || undefined;

    if (!userId) {
      return NextResponse.json({ error: "userId es requerido" }, { status: 400 });
    }

    const result = await deleteUser(userId, confirmEmail);

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    await logAdminAction({
      targetId: userId,
      action: "OWNER_DELETED",
      details: {},
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Error al eliminar usuario" }, { status: 500 });
  }
}
