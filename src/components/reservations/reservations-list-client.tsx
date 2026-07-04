"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, Plus, Eye, Grid, List, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationDetailDialog } from "@/components/reservations/reservation-detail-dialog";
import { ReservationTable } from "@/components/reservations/reservation-table";
import { ReservationListItem } from "@/components/reservations/reservation-list-item";
import { ReservationsKpiCards } from "@/components/reservations/reservations-kpi-cards";
import { ReservationsBulkActionsBar } from "@/components/reservations/reservations-bulk-actions-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/use-pagination";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useReservationFilters } from "@/hooks/use-reservation-filters";
import { toast } from "sonner";
import {
  createReservation,
  updateReservation,
  cancelReservation,
  deleteReservation,
} from "@/lib/actions/reservations";
import { getReservationPaidAmount } from "@/lib/payments/calculations";
import type { ReservationInput } from "@/lib/validations/reservation";
import type {
  Reservation,
  ReservationProperty,
  ReservationClient,
  PaginatedReservations,
} from "@/components/reservations/types";

interface ReservationsListClientProps {
  initialData: PaginatedReservations;
  properties: ReservationProperty[];
  clients: ReservationClient[];
  plan?: string;
}

export function ReservationsListClient({
  initialData,
  properties,
  clients,
  plan = "FREE",
}: ReservationsListClientProps) {
  const searchParams = useSearchParams();

  // Server-fetched reservations (affected by server-side filters)
  const [serverReservations, setServerReservations] = useState<Reservation[]>(initialData.data);
  const [total, setTotal] = useState(initialData.total);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);

  // View mode
  const [viewMode, setViewMode] = useState<"list" | "table">("table");
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [viewingReservation, setViewingReservation] = useState<Reservation | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }>(null);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination
  const { page, limit, goToPage, setLimit } = usePagination({ total, totalPages, defaultPage: 1, defaultLimit: 10 });

  // Server-side filter changes trigger re-fetch
  const fetchReservations = useCallback(async (
    filters: { propertyId: string; billingType: string; status: string }
  ) => {
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (filters.propertyId) params.append("propertyId", filters.propertyId);
      if (filters.billingType) params.append("billingType", filters.billingType);
      if (filters.status) params.append("status", filters.status);
      const res = await fetch(`/api/reservations?${params}`);
      const data = await res.json();
      setServerReservations(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      return data as { data: Reservation[]; total: number; page: number; totalPages: number };
    } catch {
      return null;
    }
  }, [page, limit]);

  const skipNextFetchRef = useRef(false);

  const {
    serverFilters,
    paymentFilter,
    searchQuery,
    filteredReservations,
    hasActiveFilters,
    updateServerFilter,
    updatePaymentFilter,
    handleSearchChange,
    clearAllFilters,
  } = useReservationFilters({
    serverReservations,
    onServerFiltersChange: fetchReservations,
  });

  // Re-fetch when server filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch updates component state intentionally
    fetchReservations(serverFilters);
  }, [serverFilters, fetchReservations]);

  // Reset to page 1 when server filters change
  useEffect(() => {
    if (page !== 1) {
      skipNextFetchRef.current = true;
      goToPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverFilters.propertyId, serverFilters.billingType, serverFilters.status, goToPage]);

  // Effective view mode: mobile always uses list
  const effectiveViewMode = isMobile ? "list" : viewMode;

  // KPI metrics
  const totalReserved = filteredReservations.reduce((sum, res) => sum + Number(res.totalPrice), 0);
  const totalPaid = filteredReservations.reduce(
    (sum, res) => sum + getReservationPaidAmount(res.payments),
    0,
  );
  const activeCount = filteredReservations.filter(
    (res) => res.status !== "CANCELLED" && res.status !== "COMPLETED",
  ).length;
  const pendingAmount = Math.max(totalReserved - totalPaid, 0);

  // Open detail dialog from URL param
  useEffect(() => {
    const reservationId = searchParams.get("reservationId");
    if (!reservationId) return;
    const target = serverReservations.find((reservation) => reservation.id === reservationId);
    if (target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync URL param to UI state
      setViewingReservation(target);
    }
  }, [searchParams, serverReservations]);

  // CRUD handlers
  const handleRefresh = useCallback(async () => {
    await fetchReservations(serverFilters);
  }, [fetchReservations, serverFilters]);

  // Selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Bulk actions
  const handleBulkCancel = useCallback(() => {
    const ids = Array.from(selectedIds);
    setConfirmAction({
      title: "Cancelar reservas",
      description: `Se cancelarán ${ids.length} reserva${ids.length > 1 ? "s" : ""}. Los pagos completados se mantendrán como registro financiero.`,
      confirmLabel: "Cancelar reservas",
      onConfirm: async () => {
        for (const id of ids) {
          await cancelReservation(id, "cancelled_by_user");
        }
        toast.success(`${ids.length} reserva${ids.length > 1 ? "s" : ""} cancelada${ids.length > 1 ? "s" : ""}`);
        clearSelection();
        handleRefresh();
      },
    });
  }, [selectedIds, clearSelection, handleRefresh]);

  const handleGenerateLinks = useCallback(() => {
    toast.info("Generación de links en lotecoming soon");
  }, []);

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
              {!isMobile && (
                <div className="flex border rounded-md">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 ${effectiveViewMode === "list" ? "bg-muted" : ""}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("table")}
                    className={`p-2 ${effectiveViewMode === "table" ? "bg-muted" : ""}`}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                </div>
              )}
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Reserva
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {serverReservations.length === 0 && !hasActiveFilters ? (
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
              {/* KPI Cards */}
              <ReservationsKpiCards
                filteredCount={filteredReservations.length}
                activeCount={activeCount}
                totalPaid={totalPaid}
                pendingAmount={pendingAmount}
                totalReserved={totalReserved}
              />

              {/* Filter Bar */}
              <div className="mb-4 overflow-hidden rounded-xl border border-foreground/10 bg-gradient-to-br from-muted/40 via-muted/20 to-background shadow-sm sm:rounded-2xl">
                <div className="flex flex-col gap-3 p-3 sm:gap-4 sm:p-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-wrap items-end gap-2 sm:gap-3 lg:flex-1">
                    {/* Search */}
                    <div className="w-full sm:w-60">
                      <div className="relative">
                        <Eye className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <input
                          value={searchQuery}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          placeholder="Buscar cliente..."
                          className="h-9 sm:h-10 w-full rounded-lg border border-input bg-transparent pl-8 pr-2.5 text-sm shadow-inner outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground"
                        />
                      </div>
                    </div>

                    {/* Estado */}
                    <select
                      value={serverFilters.status}
                      onChange={(e) => updateServerFilter("status", e.target.value)}
                      className="h-9 sm:h-10 w-full rounded-lg border border-input bg-background/80 px-2.5 text-sm font-medium text-foreground shadow-inner outline-none transition-colors sm:w-44"
                    >
                      <option value="">Todos los estados</option>
                      <option value="PENDING">Pendiente</option>
                      <option value="CONFIRMED">Confirmada</option>
                      <option value="CANCELLED">Cancelada</option>
                      <option value="COMPLETED">Completada</option>
                    </select>

                    {/* Billing type */}
                    <select
                      value={serverFilters.billingType}
                      onChange={(e) => updateServerFilter("billingType", e.target.value)}
                      className="h-9 sm:h-10 w-full rounded-lg border border-input bg-background/80 px-2.5 text-sm font-medium text-foreground shadow-inner outline-none transition-colors sm:w-40"
                    >
                      <option value="">Todos los tipos</option>
                      <option value="DAILY">Diario</option>
                      <option value="MONTHLY">Mensual</option>
                    </select>

                    {/* Propiedad */}
                    <select
                      value={serverFilters.propertyId}
                      onChange={(e) => updateServerFilter("propertyId", e.target.value)}
                      className="h-9 sm:h-10 w-full rounded-lg border border-input bg-background/80 px-2.5 text-sm font-medium text-foreground shadow-inner outline-none transition-colors sm:w-48"
                    >
                      <option value="">Todas las propiedades</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>

                    {/* Pago */}
                    <select
                      value={paymentFilter}
                      onChange={(e) => updatePaymentFilter(e.target.value)}
                      className="h-9 sm:h-10 w-full rounded-lg border border-input bg-background/80 px-2.5 text-sm font-medium text-foreground shadow-inner outline-none transition-colors sm:w-40"
                    >
                      <option value="">Todos los pagos</option>
                      <option value="paid">Pagado</option>
                      <option value="pending">Pendiente</option>
                      <option value="overpaid">Exceso</option>
                    </select>
                  </div>

                  {hasActiveFilters && (
                    <div className="flex lg:shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="h-9 sm:h-10 rounded-lg px-3 text-xs sm:text-sm"
                      >
                        <X className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                        Limpiar
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Counter */}
              <div className="mb-4 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{filteredReservations.length}</span>{" "}
                de {total} reserva{total !== 1 ? "s" : ""}
              </div>

              {filteredReservations.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center">
                  <Calendar className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                  <h3 className="text-lg font-medium">No hay reservas con estos filtros</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Prueba limpiar los filtros o crea una nueva reserva.</p>
                  {hasActiveFilters && (
                    <Button className="mt-4" variant="outline" onClick={clearAllFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              ) : effectiveViewMode === "table" ? (
                <div className="overflow-x-auto">
                  <ReservationTable
                    reservations={filteredReservations}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onView={(id) => {
                      const res = serverReservations.find((r) => r.id === id);
                      if (res) setViewingReservation(res);
                    }}
                    onEdit={(id) => {
                      const res = serverReservations.find((r) => r.id === id);
                      if (res) setEditingReservation(res);
                    }}
                    onCancel={(id) => handleCancel(id)}
                    onDelete={(id) => handleDelete(id)}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReservations.map((reservation) => (
                    <ReservationListItem
                      key={reservation.id}
                      reservation={reservation}
                      isSelected={selectedIds.has(reservation.id)}
                      onToggleSelect={toggleSelect}
                      onView={(res) => setViewingReservation(res)}
                      onEdit={(res) => setEditingReservation(res)}
                      onCancel={handleCancel}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {total > limit && (
        <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={goToPage} onLimitChange={setLimit} />
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <ReservationsBulkActionsBar
          selectedCount={selectedIds.size}
          onClearSelection={clearSelection}
          onBulkCancel={handleBulkCancel}
          onGenerateLinks={handleGenerateLinks}
        />
      )}

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
            <p className="p-6 text-muted-foreground">
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
            const data = await fetchReservations(serverFilters);
            if (data?.data) {
              const fresh = data.data.find((r) => r.id === reservationId);
              if (fresh) setViewingReservation(fresh);
            }
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
