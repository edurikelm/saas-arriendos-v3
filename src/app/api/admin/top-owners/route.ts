import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const admin = await prisma.userProfile.findUnique({
      where: { id: session.userId },
    });

    if (admin?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const topOwners = await prisma.userProfile.findMany({
      where: { role: "OWNER" },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        createdAt: true,
        _count: {
          select: {
            properties: true,
            reservations: true,
          },
        },
        properties: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const ownerIds = topOwners.map((o) => o.id);

    const payments = await prisma.payment.findMany({
      where: {
        reservation: { userId: { in: ownerIds } },
        status: "COMPLETED",
      },
      select: {
        amount: true,
        reservation: {
          select: { userId: true },
        },
      },
    });

    const revenueByOwner: Record<string, number> = {};
    payments.forEach((p) => {
      const userId = p.reservation.userId;
      revenueByOwner[userId] = (revenueByOwner[userId] || 0) + Number(p.amount);
    });

    const ownersWithRevenue = topOwners.map((owner) => ({
      id: owner.id,
      email: owner.email,
      name: owner.name,
      plan: owner.plan,
      createdAt: owner.createdAt,
      properties: owner._count.properties,
      reservations: owner._count.reservations,
      revenue: revenueByOwner[owner.id] || 0,
    }));

    ownersWithRevenue.sort((a, b) => b.reservations - a.reservations);

    return NextResponse.json(ownersWithRevenue.slice(0, 5));
  } catch (error) {
    console.error("Error fetching top owners:", error);
    return NextResponse.json({ error: "Error al obtener top owners" }, { status: 500 });
  }
}