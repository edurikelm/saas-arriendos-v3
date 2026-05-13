"use client";

import { useState } from "react";
import { Calendar, Plus, Pencil, Trash2, Eye, Grid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationDetailDialog } from "@/components/reservations/reservation-detail-dialog";
import { ReservationTable } from "@/components/reservations/reservation-table";
import { toast } from "sonner";
import {
  createReservation,
  updateReservation,
  cancelReservation,
  deleteReservation,
  getReservations,
} from "@/lib/actions/reservations";
import type { ReservationInput } from "@/lib/validations/reservation";

interface Property {
  id: string;
  name: string;
  unitsAvailable: number;
  dailyPrice: string;
  monthlyPrice: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

interface Reservation {
  id: string;
  propertyId: string;
  clientId: string;
  startDate: string;
  endDate: string;
  billingType: string;
  unitsBooked: number;
  totalPrice: string;
  status: string;
  bookingAirbnb: boolean;
  notes: string | null;
  property: Property;
  client: Client;
  payments: Array<{
    id: string;
    amount: string;
    status: string;
    method: string;
    initPoint?: string | null;
    expiresAt?: string | null;
    deletedAt?: string | null;
  }>;
}

interface ReservationsListClientProps {
  initialReservations: Reservation[];
  properties: Property[];
  clients: Client[];
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  CONFIRMED: { label: "Confirmada", variant: "default" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  COMPLETED: { label: "Completada", variant: "outline" },
};

function differenceInDays(end: Date, start: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function getNights(startDate: string, endDate: string): number {
  return differenceInDays(new Date(endDate), new Date(startDate)) + 1;
}

export function ReservationsListClient({
  initialReservations,
  properties,
  clients,
}: ReservationsListClientProps) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  const [viewMode, setViewMode] = useState<"list" | "table">("table");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [viewingReservation, setViewingReservation] = useState<Reservation | null>(null);

  const handleRefresh = async () => {
    const updated = await getReservations();
    setReservations(updated as unknown as Reservation[]);
  };

  const handleCreate = async (data: ReservationInput) => {
    const result = await createReservation(data);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Reserva creada correctamente");
    setIsCreateOpen(false);
    handleRefresh();
  };

  const handleCancel = async (id: string) => {
    if (!confirm("¿Estás seguro de cancelar esta reserva?")) return;
    const result = await cancelReservation(id, "cancelled_by_user");
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Reserva cancelada");
    handleRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta reserva? Esta acción no se puede deshacer.")) return;
    const result = await deleteReservation(id);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Reserva eliminada");
    handleRefresh();
  };

  const handleEdit = async (data: ReservationInput) => {
    if (!editingReservation) return;
    const result = await updateReservation(editingReservation.id, data);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Reserva actualizada correctamente");
    setEditingReservation(null);
    handleRefresh();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reservas</h1>
          <p className="text-muted-foreground">Gestiona las reservas de tus propiedades</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-md">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 ${viewMode === "list" ? "bg-muted" : ""}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 ${viewMode === "table" ? "bg-muted" : ""}`}
            >
              <Grid className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Reserva
          </Button>
        </div>
      </div>

      {reservations.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No hay reservas</h3>
          <p className="text-muted-foreground mb-4">Crea tu primera reserva para comenzar</p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Reserva
          </Button>
        </div>
      ) : viewMode === "table" ? (
        <div className="overflow-x-auto">
          <ReservationTable
            reservations={reservations}
            onView={(id) => {
              const res = reservations.find((r) => r.id === id);
              if (res) setViewingReservation(res);
            }}
            onEdit={(id) => {
              const res = reservations.find((r) => r.id === id);
              if (res) setEditingReservation(res);
            }}
            onCancel={(id) => handleCancel(id)}
            onDelete={(id) => handleDelete(id)}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((reservation) => {
            const status = statusLabels[reservation.status] || statusLabels.PENDING;
            const paidAmount = reservation.payments
              .filter((p) => p.status === "COMPLETED")
              .reduce((sum, p) => sum + Number(p.amount), 0);
            const pendingAmount = Number(reservation.totalPrice) - paidAmount;

            return (
              <Card key={reservation.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{reservation.property.name}</CardTitle>
                      <CardDescription>
                        {reservation.client.name} • {reservation.client.email}
                      </CardDescription>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Fechas</p>
                      <p className="font-medium">
                        {formatDate(reservation.startDate)} - {formatDate(reservation.endDate)}
                        <span className="text-muted-foreground ml-1">
                          ({getNights(reservation.startDate, reservation.endDate)} noches)
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tipo</p>
                      <p className="font-medium">
                        {reservation.billingType === "DAILY" ? "Diario" : "Mensual"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Unidades</p>
                      <p className="font-medium">{reservation.unitsBooked}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-medium">${Number(reservation.totalPrice).toLocaleString("CLP")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Pagado/Pendiente</p>
                      <p className="font-medium text-green-600">
                        ${paidAmount.toLocaleString("CLP")}
                      </p>
                      {pendingAmount > 0 && (
                        <p className="text-xs text-orange-600">
                          ${pendingAmount.toLocaleString("CLP")} pendiente
                        </p>
                      )}
                    </div>
                  </div>

                  {reservation.notes && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      <span className="font-medium">Notas:</span> {reservation.notes}
                    </p>
                  )}

                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingReservation(reservation)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingReservation(reservation)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    {reservation.status !== "CANCELLED" && reservation.status !== "COMPLETED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(reservation.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    )}
                    {(reservation.status === "CANCELLED" || reservation.status === "COMPLETED") && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(reservation.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva Reserva</DialogTitle>
          </DialogHeader>
          {properties.length > 0 && clients.length > 0 ? (
            <ReservationForm
              properties={properties}
              clients={clients}
              onSubmit={handleCreate}
              onCancel={() => setIsCreateOpen(false)}
            />
          ) : (
            <p className="text-muted-foreground">
              Primero necesitas crear propiedades y clientes.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {viewingReservation && (
        <ReservationDetailDialog
          reservation={viewingReservation}
          open={!!viewingReservation}
          onClose={() => setViewingReservation(null)}
          onEdit={() => {
            setViewingReservation(null);
            setEditingReservation(viewingReservation);
          }}
          onCancel={() => {
            if (!viewingReservation) return;
            if (!confirm("¿Estás seguro de cancelar esta reserva?")) return;
            handleCancel(viewingReservation.id);
            setViewingReservation(null);
          }}
          onRefresh={async (reservationId) => {
            const updated = await getReservations();
            const freshList = updated as unknown as Reservation[];
            setReservations(freshList);
            const fresh = freshList.find((r) => r.id === reservationId);
            if (fresh) setViewingReservation(fresh);
          }}
        />
      )}

      <Dialog open={!!editingReservation} onOpenChange={() => setEditingReservation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Reserva</DialogTitle>
          </DialogHeader>
          {editingReservation && properties.length > 0 && clients.length > 0 && (
            <ReservationForm
              properties={properties}
              clients={clients}
              initialData={{
                propertyId: editingReservation.propertyId,
                clientId: editingReservation.clientId,
                startDate: new Date(editingReservation.startDate),
                endDate: new Date(editingReservation.endDate),
                billingType: editingReservation.billingType as "DAILY" | "MONTHLY",
                unitsBooked: editingReservation.unitsBooked,
                bookingAirbnb: editingReservation.bookingAirbnb,
                notes: editingReservation.notes || "",
              }}
              onSubmit={handleEdit}
              onCancel={() => setEditingReservation(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}