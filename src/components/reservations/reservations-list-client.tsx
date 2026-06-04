"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, Plus, Pencil, Trash2, Eye, Grid, List, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationDetailDialog } from "@/components/reservations/reservation-detail-dialog";
import { ReservationTable } from "@/components/reservations/reservation-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/use-pagination";
import { toast } from "sonner";
import {
  createReservation,
  updateReservation,
  cancelReservation,
  deleteReservation,
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
  createdAt: string;
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
  initialData: { data: Reservation[]; total: number; page: number; totalPages: number };
  properties: Property[];
  clients: Client[];
  plan?: string;
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

function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

export function ReservationsListClient({
  initialData,
  properties,
  clients,
  plan = "FREE",
}: ReservationsListClientProps) {
  const searchParams = useSearchParams();
  const [reservations, setReservations] = useState<Reservation[]>(initialData.data);
  const [total, setTotal] = useState(initialData.total);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [viewMode, setViewMode] = useState<"list" | "table">("table");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [viewingReservation, setViewingReservation] = useState<Reservation | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }>(null);

  const [filters, setFilters] = useState({
    propertyId: "",
    billingType: "",
    status: "",
    payment: "",
  });

  const { page, limit, goToPage, setLimit } = usePagination({ total, totalPages, defaultPage: 1, defaultLimit: 10 });

  const fetchReservations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (filters.propertyId) params.append("propertyId", filters.propertyId);
      if (filters.billingType) params.append("billingType", filters.billingType);
      if (filters.status) params.append("status", filters.status);
      const res = await fetch(`/api/reservations?${params}`);
      const data = await res.json();
      setReservations(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      // ignore
    }
  }, [page, limit, filters.propertyId, filters.billingType, filters.status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    fetchReservations();
  }, [page, fetchReservations]);

  useEffect(() => {
    if (page !== 1) {
      goToPage(1);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on filter change
      fetchReservations();
    }
  }, [filters.propertyId, filters.billingType, filters.status, goToPage, fetchReservations, page]);

  const filteredReservations = useMemo(() => {
    if (!filters.payment) return reservations;

    return reservations.filter((res) => {
      const paidAmount = res.payments
        .filter((p) => p.status === "COMPLETED")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const totalPrice = Number(res.totalPrice);
      if (filters.payment === "paid" && paidAmount < totalPrice) return false;
      if (filters.payment === "pending" && paidAmount > 0) return false;
      if (filters.payment === "overpaid" && paidAmount <= totalPrice) return false;
      return true;
    });
  }, [reservations, filters.payment]);

  const totalReserved = filteredReservations.reduce((sum, res) => sum + Number(res.totalPrice), 0);
  const totalPaid = filteredReservations.reduce(
    (sum, res) => sum + res.payments
      .filter((payment) => payment.status === "COMPLETED")
      .reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0),
    0,
  );
  const activeCount = filteredReservations.filter((res) => res.status !== "CANCELLED" && res.status !== "COMPLETED").length;
  const pendingAmount = Math.max(totalReserved - totalPaid, 0);

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");

  useEffect(() => {
    const reservationId = searchParams.get("reservationId");
    if (!reservationId) return;

    const target = reservations.find((reservation) => reservation.id === reservationId);
    if (target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync URL param to UI state
      setViewingReservation(target);
    }
  }, [searchParams, reservations]);

  const clearFilters = () => {
    setFilters({ propertyId: "", billingType: "", status: "", payment: "" });
  };

  const handleRefresh = async () => {
    await fetchReservations();
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

  const performCancel = async (id: string) => {
    const result = await cancelReservation(id, "cancelled_by_user");
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Reserva cancelada");
    handleRefresh();
  };

  const handleCancel = (id: string, afterConfirm?: () => void) => {
    setConfirmAction({
      title: "Cancelar reserva",
      description: "La reserva quedará cancelada, pero se mantendrán los pagos completados como registro financiero.",
      confirmLabel: "Cancelar reserva",
      onConfirm: async () => {
        await performCancel(id);
        afterConfirm?.();
      },
    });
  };

  const performDelete = async (id: string) => {
    const result = await deleteReservation(id);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Reserva eliminada");
    handleRefresh();
  };

  const handleDelete = (id: string) => {
    setIsCreateOpen(false);
    setEditingReservation(null);
    setViewingReservation(null);
    setConfirmAction({
      title: "Eliminar reserva",
      description: "Esta acción no se puede deshacer. Se eliminará la reserva seleccionada del listado.",
      confirmLabel: "Eliminar reserva",
      onConfirm: () => performDelete(id),
    });
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reservas</CardTitle>
              <CardDescription>Gestiona las reservas de tus propiedades</CardDescription>
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
        </CardHeader>
        <CardContent>
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
          ) : (
            <>
              <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.06] p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-500">Reservas filtradas</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{filteredReservations.length}</p>
                  <p className="text-xs text-muted-foreground">{activeCount} activas o pendientes</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-500">Cobrado</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{formatPrice(totalPaid)}</p>
                  <p className="text-xs text-muted-foreground">Pagos completados</p>
                </div>
                <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-500">Por cobrar</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{formatPrice(pendingAmount)}</p>
                  <p className="text-xs text-muted-foreground">Saldo de la selección</p>
                </div>
                <div className="rounded-2xl border border-zinc-500/15 bg-zinc-500/[0.06] p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total reservado</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{formatPrice(totalReserved)}</p>
                  <p className="text-xs text-muted-foreground">Valor bruto</p>
                </div>
              </div>

              <div className="mb-6 overflow-hidden rounded-2xl border border-foreground/10 bg-gradient-to-br from-muted/40 via-muted/20 to-background shadow-sm">
                <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex items-start justify-between gap-3 lg:w-52">
                    <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
                      <Filter className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Filtros</p>
                      <p className="text-xs text-muted-foreground">
                        {filteredReservations.length} de {reservations.length} reservas
                      </p>
                    </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFilters((current) => !current)}
                      className="h-8 rounded-lg px-2 text-xs lg:hidden"
                    >
                      {showFilters ? "Ocultar" : "Mostrar"}
                    </Button>
                  </div>

                  <div className={`${showFilters ? "grid" : "hidden"} flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4`}>
                    <label>
                      <select
                        value={filters.propertyId}
                        onChange={(e) => setFilters({ ...filters, propertyId: e.target.value })}
                        className="h-10 w-full rounded-xl border border-foreground/10 bg-background/80 px-3 text-sm font-medium text-foreground shadow-inner outline-none transition-colors hover:border-foreground/20 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/15"
                      >
                        <option value="">Todas las propiedades</option>
                        {properties.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <select
                        value={filters.billingType}
                        onChange={(e) => setFilters({ ...filters, billingType: e.target.value })}
                        className="h-10 w-full rounded-xl border border-foreground/10 bg-background/80 px-3 text-sm font-medium text-foreground shadow-inner outline-none transition-colors hover:border-foreground/20 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/15"
                      >
                        <option value="">Todos los tipos</option>
                        <option value="DAILY">Diario</option>
                        <option value="MONTHLY">Mensual</option>
                      </select>
                    </label>

                    <label>
                      <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="h-10 w-full rounded-xl border border-foreground/10 bg-background/80 px-3 text-sm font-medium text-foreground shadow-inner outline-none transition-colors hover:border-foreground/20 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/15"
                      >
                        <option value="">Todos los estados</option>
                        <option value="PENDING">Pendiente</option>
                        <option value="CONFIRMED">Confirmada</option>
                        <option value="CANCELLED">Cancelada</option>
                        <option value="COMPLETED">Completada</option>
                      </select>
                    </label>

                    <label>
                      <select
                        value={filters.payment}
                        onChange={(e) => setFilters({ ...filters, payment: e.target.value })}
                        className="h-10 w-full rounded-xl border border-foreground/10 bg-background/80 px-3 text-sm font-medium text-foreground shadow-inner outline-none transition-colors hover:border-foreground/20 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/15"
                      >
                        <option value="">Todos los pagos</option>
                        <option value="paid">Pagado</option>
                        <option value="pending">Pendiente</option>
                        <option value="overpaid">Exceso</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex gap-2 lg:flex-col">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters((current) => !current)}
                      className="hidden h-10 shrink-0 rounded-xl lg:inline-flex"
                    >
                      <Filter className="mr-1.5 h-4 w-4" />
                      {showFilters ? "Ocultar" : "Mostrar"}
                    </Button>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={clearFilters} className="h-10 shrink-0 rounded-xl">
                        <X className="mr-1.5 h-4 w-4" />
                        Limpiar filtros
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {filteredReservations.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center">
                  <Calendar className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                  <h3 className="text-lg font-medium">No hay reservas con estos filtros</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Prueba limpiar los filtros o crea una nueva reserva.</p>
                  {hasActiveFilters && (
                    <Button className="mt-4" variant="outline" onClick={clearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              ) : viewMode === "table" ? (
                <div className="overflow-x-auto">
                  <ReservationTable
                    reservations={filteredReservations}
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
                  {filteredReservations.map((reservation) => {
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
            </>
          )}

          {total > limit && (
            <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={goToPage} onLimitChange={setLimit} />
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] max-w-2xl gap-0 p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-4 pr-12">
            <DialogTitle>Nueva Reserva</DialogTitle>
            <DialogDescription>
              Completa los datos principales de la estadía y confirma la reserva.
            </DialogDescription>
          </DialogHeader>
          {properties.length > 0 && clients.length > 0 ? (
            <ReservationForm
              properties={properties}
              clients={clients}
              onSubmit={handleCreate}
              onCancel={() => setIsCreateOpen(false)}
              plan={plan as "FREE" | "PRO"}
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
          plan={plan as "FREE" | "PRO"}
          onClose={() => setViewingReservation(null)}
          onEdit={() => {
            setViewingReservation(null);
            setEditingReservation(viewingReservation);
          }}
          onCancel={() => {
            if (!viewingReservation) return;
            handleCancel(viewingReservation.id, () => setViewingReservation(null));
          }}
          onRefresh={async (reservationId) => {
            await fetchReservations();
            const fresh = reservations.find((r) => r.id === reservationId);
            if (fresh) setViewingReservation(fresh);
          }}
        />
      )}

      <Dialog open={!!editingReservation} onOpenChange={() => setEditingReservation(null)}>
        <DialogContent className="w-[95vw] max-w-2xl gap-0 p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-4 pr-12">
            <DialogTitle>Editar Reserva</DialogTitle>
            <DialogDescription>
              Ajusta los datos de la estadía manteniendo el registro de cambios.
            </DialogDescription>
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
              plan={plan as "FREE" | "PRO"}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={confirmAction?.title ?? "Confirmar acción"}
        description={confirmAction?.description ?? "Esta acción requiere confirmación."}
        confirmLabel={confirmAction?.confirmLabel}
        onConfirm={async () => {
          await confirmAction?.onConfirm();
          setConfirmAction(null);
        }}
      />
    </div>
  );
}
