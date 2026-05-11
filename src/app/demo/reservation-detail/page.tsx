"use client";

import { ReservationDetailTimeline } from "@/prototypes/reservation-detail-prototypes";
import { useState } from "react";

const mockReservation = {
  id: "1",
  propertyId: "1",
  clientId: "1",
  startDate: "2026-05-15",
  endDate: "2026-05-20",
  billingType: "DAILY",
  unitsBooked: 1,
  totalPrice: "425000",
  status: "CONFIRMED",
  bookingAirbnb: true,
  notes: "Cliente prefiere silencio. Necesita sofá cama extra.",
  property: { id: "1", name: "Casa del Lago", color: "#3B82F6" },
  client: {
    id: "1",
    name: "María García",
    email: "maria.garcia@gmail.com",
    phone: "+56 9 1234 5678",
  },
  payments: [
    {
      id: "p1",
      amount: "200000",
      status: "COMPLETED",
      method: "MERCADO_PAGO",
    },
    {
      id: "p2",
      amount: "225000",
      status: "PENDING",
      method: "TRANSFER",
      expiresAt: "2026-05-10T23:59:59Z",
    },
  ],
};

export default function ReservationDetailDemoPage() {
  const [showModal, setShowModal] = useState(true);

  return (
    <div className="min-h-screen p-8 bg-background">
      <h1 className="text-2xl font-bold mb-6">Reservation Detail Modal - Demo</h1>

      <div className="mb-8 p-6 bg-muted/30 rounded-xl max-w-4xl">
        <p className="text-sm text-muted-foreground mb-4">
          Este demo muestra el modal en tamaño grande (max-w-2xl) para visualizar todo el contenido correctamente.
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-8 px-2.5 text-sm font-medium hover:bg-primary/80 transition-colors"
        >
          Abrir Modal Grande
        </button>
      </div>

      <ReservationDetailTimeline
        reservation={mockReservation}
        open={showModal}
        onClose={() => setShowModal(false)}
        onCopyLink={(initPoint) => console.log("Copy:", initPoint)}
        onRegenerateLink={(id) => console.log("Regenerate:", id)}
        onConfirmPayment={(id) => console.log("Confirm:", id)}
        onDeletePayment={(id) => console.log("Delete:", id)}
        onAddPayment={() => console.log("Add payment")}
      />
    </div>
  );
}
