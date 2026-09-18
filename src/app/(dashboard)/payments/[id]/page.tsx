import { notFound, redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

/**
 * Un pago no tiene página propia: se ve dentro de su reserva.
 *
 * Esta ruta existe porque las notificaciones de pago anteriores guardaron
 * `link: /payments/<id>`, que daba 404. Las nuevas ya apuntan a la reserva;
 * las viejas llegan acá y se redirigen. No filtra `deletedAt`: si el pago se
 * eliminó, la reserva sigue siendo el lugar donde mirar.
 */
export default async function PaymentRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireOwner();

  const payment = await prisma.payment.findFirst({
    where: { id, reservation: { userId: session.userId } },
    select: { reservationId: true },
  });

  if (!payment) notFound();
  redirect(`/reservations/${payment.reservationId}`);
}
