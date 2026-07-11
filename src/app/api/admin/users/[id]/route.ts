import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSuperAdminSession } from "@/lib/auth/session";

interface OwnerStats {
  properties: number;
  clients: number;
  reservations: number;
  totalRevenue: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  propertiesLimit: number;
  hasMpIntegration: boolean;
  isMpConnected: boolean;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await getSuperAdminSession())) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    const owner = await prisma.userProfile.findUnique({
      where: { id, role: "OWNER" },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            properties: true,
            clients: true,
            reservations: true,
          },
        },
      },
    });

    if (!owner) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const now = new Date();

    const [payments, mpIntegration] = await Promise.all([
      prisma.payment.findMany({
        where: { reservation: { userId: id } },
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
          dueDate: true,
          paidAt: true,
        },
      }),
      prisma.userIntegration.findUnique({
        where: { userId_provider: { userId: id, provider: "MERCADO_PAGO" } },
        select: { isActive: true },
      }),
    ]);

    const paidAmount = payments
      .filter((p) => p.status === "COMPLETED" && p.paidAt)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const pendingPayments = payments.filter(
      (p) => p.status === "PENDING" || (p.status === "COMPLETED" && !p.paidAt)
    );
    const pendingAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const overduePayments = pendingPayments.filter(
      (p) => p.dueDate && p.dueDate < now
    );
    const overdueAmount = overduePayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const totalRevenue = payments
      .filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const propertiesLimit = owner.plan === "FREE" ? 3 : -1;
    const hasMpIntegration = !!mpIntegration;
    const isMpConnected = mpIntegration?.isActive ?? false;

    const stats: OwnerStats = {
      properties: owner._count.properties,
      clients: owner._count.clients,
      reservations: owner._count.reservations,
      totalRevenue,
      paidAmount,
      pendingAmount,
      overdueAmount,
      propertiesLimit,
      hasMpIntegration,
      isMpConnected,
    };

    return NextResponse.json({ owner, stats });
  } catch (error) {
    console.error("Error fetching user detail:", error);
    return NextResponse.json({ error: "Error al obtener usuario" }, { status: 500 });
  }
}