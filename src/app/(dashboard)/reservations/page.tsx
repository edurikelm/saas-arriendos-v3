"use client";

import { useState, useEffect } from "react";
import { Calendar, Plus, Pencil, Trash2, Eye, Grid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationTable } from "@/prototypes/reservation-card-prototypes";
import { toast } from "sonner";
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
  }>;
}

function differenceInDays(end: Date, start: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function getNights(startDate: string, endDate: string): number {
  return differenceInDays(new Date(endDate), new Date(startDate)) + 1;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendiente", variant: "secondary" },
  CONFIRMED: { label: "Confirmada", variant: "default" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  COMPLETED: { label: "Completada", variant: "outline" },
};

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "table">("table");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [viewingReservation, setViewingReservation] = useState<Reservation | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [reservationsRes, propertiesRes, clientsRes] = await Promise.all([
        fetch("/api/reservations"),
        fetch("/api/properties"),
        fetch("/api/clients"),
      ]);

      if (!reservationsRes.ok) {
        toast.error("Error al cargar reservas");
        return;
      }
      setReservations(await reservationsRes.json());
      if (propertiesRes.ok) setProperties(await propertiesRes.json());
      if (clientsRes.ok) setClients(await clientsRes.json());
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: ReservationInput) => {
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Reserva creada correctamente");
      setIsCreateOpen(false);
      fetchData();
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("¿Estás seguro de cancelar esta reserva?")) return;

    try {
      const res = await fetch(`/api/reservations/${id}?reason=cancelled_by_user`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Error al cancelar reserva");
        return;
      }

      toast.success("Reserva cancelada");
      fetchData();
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta reserva? Esta acción no se puede deshacer.")) return;

    try {
      const res = await fetch(`/api/reservations/${id}?permanent=true`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Error al eliminar reserva");
        return;
      }

      toast.success("Reserva eliminada");
      fetchData();
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleEdit = async (data: ReservationInput) => {
    if (!editingReservation) return;

    try {
      const res = await fetch(`/api/reservations/${editingReservation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Reserva actualizada correctamente");
      setEditingReservation(null);
      fetchData();
    } catch {
      toast.error("Error de conexión");
    }
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

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando...</div>
      ) : reservations.length === 0 ? (
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

      <Dialog open={!!viewingReservation} onOpenChange={() => setViewingReservation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle de Reserva</DialogTitle>
          </DialogHeader>
          {viewingReservation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Propiedad</p>
                  <p className="font-medium">{viewingReservation.property.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{viewingReservation.client.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fechas</p>
                  <p className="font-medium">
                    {formatDate(viewingReservation.startDate)} - {formatDate(viewingReservation.endDate)}
                    <span className="text-muted-foreground ml-1">
                      ({getNights(viewingReservation.startDate, viewingReservation.endDate)} noches)
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <Badge variant={statusLabels[viewingReservation.status]?.variant}>
                    {statusLabels[viewingReservation.status]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo</p>
                  <p className="font-medium">
                    {viewingReservation.billingType === "DAILY" ? "Diario" : "Mensual"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Unidades</p>
                  <p className="font-medium">{viewingReservation.unitsBooked}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">${Number(viewingReservation.totalPrice).toLocaleString("CLP")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Booking Airbnb</p>
                  <p className="font-medium">{viewingReservation.bookingAirbnb ? "Sí" : "No"}</p>
                </div>
              </div>
              {viewingReservation.notes && (
                <div>
                  <p className="text-muted-foreground">Notas</p>
                  <p className="font-medium">{viewingReservation.notes}</p>
                </div>
              )}
              {viewingReservation.payments.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2">Pagos</p>
                  <div className="space-y-2">
                    {viewingReservation.payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between text-sm border-b pb-2">
                        <span>{payment.method}</span>
                        <span className={payment.status === "COMPLETED" ? "text-green-600" : "text-orange-600"}>
                          ${Number(payment.amount).toLocaleString("CLP")} ({payment.status})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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