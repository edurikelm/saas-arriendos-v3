import { NextResponse } from "next/server";
import { getSuperAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
  try {
    if (!(await getSuperAdminSession())) {
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