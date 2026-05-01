import { NextResponse } from "next/server";
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
    const targetId = searchParams.get("targetId");

    if (!targetId) {
      return NextResponse.json({ error: "targetId es requerido" }, { status: 400 });
    }

    const logs = await prisma.adminActionLog.findMany({
      where: { targetId },
      include: {
        admin: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching action logs:", error);
    return NextResponse.json({ error: "Error al obtener logs" }, { status: 500 });
  }
}