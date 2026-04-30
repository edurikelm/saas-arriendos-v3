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

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalOwners,
      totalProperties,
      totalReservations,
      completedPayments,
      ownersThisMonth,
      ownersLastMonth,
      totalOwnersCount,
      ownersWithPro,
    ] = await Promise.all([
      prisma.userProfile.count({ where: { role: "OWNER" } }),
      prisma.property.count(),
      prisma.reservation.count(),
      prisma.payment.aggregate({
        where: { status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.userProfile.count({
        where: {
          role: "OWNER",
          createdAt: { gte: startOfThisMonth },
        },
      }),
      prisma.userProfile.count({
        where: {
          role: "OWNER",
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),
      prisma.userProfile.count({ where: { role: "OWNER" } }),
      prisma.userProfile.count({ where: { role: "OWNER", plan: "PRO" } }),
    ]);

    const growthPercentage =
      ownersLastMonth === 0
        ? ownersThisMonth > 0
          ? 100
          : 0
        : Math.round(((ownersThisMonth - ownersLastMonth) / ownersLastMonth) * 100);

    const conversionPercentage =
      totalOwnersCount === 0
        ? 0
        : Math.round((ownersWithPro / totalOwnersCount) * 100);

    return NextResponse.json({
      totalOwners,
      totalProperties,
      totalReservations,
      totalRevenue: Number(completedPayments._sum.amount) || 0,
      growthPercentage,
      ownersThisMonth,
      ownersLastMonth,
      conversionPercentage,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
  }
}