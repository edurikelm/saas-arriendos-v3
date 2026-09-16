"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReservationPreviewDialog } from "@/components/reservations/reservation-preview-dialog";
import type { Reservation } from "@/components/reservations/types";

interface ReservationPreviewLinkProps {
  reservationId: string;
  className?: string;
  children: ReactNode;
}

/**
 * Link a una reserva que, con un click simple, abre el mismo preview que
 * `/calendar` (`ReservationPreviewDialog`) en vez de navegar. Desde el preview,
 * "Ver reserva completa" lleva a la página cuando hace falta actuar.
 *
 * Sigue siendo un `<a href>` real: ctrl/cmd/shift + click, click del medio y la
 * navegación sin JS abren la página como antes, y el lector de pantalla lo
 * anuncia como link.
 *
 * El detalle se trae al hacer click, por la misma ruta que usa el calendario
 * (`GET /api/reservations/[id]`): la agenda del inicio no carga notas, canal
 * ni pagos serializados, y cargarlos para cada fila sería pagar por modales que
 * casi nunca se abren. Si la ruta falla, se navega a la página: el dueño
 * igual llega a la reserva, que es lo que pidió con el click.
 */
export function ReservationPreviewLink({
  reservationId,
  className,
  children,
}: ReservationPreviewLinkProps) {
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(false);
  const href = `/reservations/${reservationId}`;

  async function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/${reservationId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReservation((await res.json()) as Reservation);
    } catch {
      router.push(href);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Link
        href={href}
        onClick={handleClick}
        aria-busy={loading || undefined}
        className={loading ? `${className ?? ""} cursor-progress opacity-70` : className}
      >
        {children}
      </Link>
      {reservation && (
        <ReservationPreviewDialog
          reservation={reservation}
          open
          onClose={() => setReservation(null)}
        />
      )}
    </>
  );
}
