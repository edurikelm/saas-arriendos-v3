import { getReservationById } from "@/lib/actions/reservations";
import { notFound } from "next/navigation";
import { ReservationDetailClient } from "./_components/reservation-detail-client";

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reservation = await getReservationById(id);
  if (!reservation) notFound();
  return <ReservationDetailClient reservation={reservation} />;
}
