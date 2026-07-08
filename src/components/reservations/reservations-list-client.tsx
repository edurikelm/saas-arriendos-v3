"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, Plus, X, X as XIcon, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationDetailDialog } from "@/components/reservations/reservation-detail-dialog";
import { ReservationTable } from "@/components/reservations/reservation-table";
import { ReservationListItem } from "@/components/reservations/reservation-list-item";
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

  // View mode: mobile always falls back to list (cards), desktop stays on table
  const [viewMode] = useState<"list" | "table">("table");
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

  // Bulk actions helpers removed — no selection mode

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
      {/* Page Header (Stitch pattern) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Reservas</h2>
          <p className="text-xs text-muted-foreground">Gestiona todas las reservas y su estado operativo</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Reserva
        </Button>
      </div>

      {/* Search + Filter Section */}
      {serverReservations.length === 0 && !hasActiveFilters ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No hay reservas</h3>
          <p className="text-muted-foreground mb-4">Crea tu primera reserva para comenzar</p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Crear Reserva
          </Button>
        </div>
      ) : (
        <>
          {/* Search + Filter Chips */}
          <div className="space-y-4">
            {/* Full Width Search */}
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar por nombre, propiedad o palabra clave..."
                className="h-10 w-full rounded-lg border border-border bg-card pl-12 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-all focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring"
              />
            </div>

            {/* Filter Chips Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Propiedad */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={`flex items-center gap-2 px-3 py-1.5 border rounded text-xs font-medium transition-colors ${
                    serverFilters.propertyId
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : "bg-card border-border text-foreground hover:border-primary"
                  }`}
                >
                  Propiedad
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="ring-1 ring-foreground/10">
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("propertyId", "")}
                    className={!serverFilters.propertyId ? "bg-accent" : ""}
                  >
                    Todas las propiedades
                  </DropdownMenuItem>
                  {properties.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => updateServerFilter("propertyId", p.id)}
                      className={serverFilters.propertyId === p.id ? "bg-accent" : ""}
                    >
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Estado */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={`flex items-center gap-2 px-3 py-1.5 border rounded text-xs font-medium transition-colors ${
                    serverFilters.status
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : "bg-card border-border text-foreground hover:border-primary"
                  }`}
                >
                  Estado
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="ring-1 ring-foreground/10">
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("status", "")}
                    className={!serverFilters.status ? "bg-accent" : ""}
                  >
                    Todos los estados
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("status", "PENDING")}
                    className={serverFilters.status === "PENDING" ? "bg-accent" : ""}
                  >
                    Pendiente
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("status", "CONFIRMED")}
                    className={serverFilters.status === "CONFIRMED" ? "bg-accent" : ""}
                  >
                    Confirmada
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("status", "CANCELLED")}
                    className={serverFilters.status === "CANCELLED" ? "bg-accent" : ""}
                  >
                    Cancelada
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("status", "COMPLETED")}
                    className={serverFilters.status === "COMPLETED" ? "bg-accent" : ""}
                  >
                    Completada
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Tipo */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={`flex items-center gap-2 px-3 py-1.5 border rounded text-xs font-medium transition-colors ${
                    serverFilters.billingType
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : "bg-card border-border text-foreground hover:border-primary"
                  }`}
                >
                  Tipo
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="ring-1 ring-foreground/10">
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("billingType", "")}
                    className={!serverFilters.billingType ? "bg-accent" : ""}
                  >
                    Todos los tipos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("billingType", "DAILY")}
                    className={serverFilters.billingType === "DAILY" ? "bg-accent" : ""}
                  >
                    Diario
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("billingType", "MONTHLY")}
                    className={serverFilters.billingType === "MONTHLY" ? "bg-accent" : ""}
                  >
                    Mensual
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Pago */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={`flex items-center gap-2 px-3 py-1.5 border rounded text-xs font-medium transition-colors ${
                    paymentFilter
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : "bg-card border-border text-foreground hover:border-primary"
                  }`}
                >
                  Pago
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="ring-1 ring-foreground/10">
                  <DropdownMenuItem
                    onClick={() => updatePaymentFilter("")}
                    className={!paymentFilter ? "bg-accent" : ""}
                  >
                    Todos los pagos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updatePaymentFilter("paid")}
                    className={paymentFilter === "paid" ? "bg-accent" : ""}
                  >
                    Pagado
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updatePaymentFilter("pending")}
                    className={paymentFilter === "pending" ? "bg-accent" : ""}
                  >
                    Pendiente
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updatePaymentFilter("overpaid")}
                    className={paymentFilter === "overpaid" ? "bg-accent" : ""}
                  >
                    Exceso
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Separator */}
              <div className="h-4 w-px bg-border mx-1" />

              {/* Limpiar filtros */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-8 px-3 text-xs font-bold text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>

          {/* Counter */}
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Mostrando {((page - 1) * limit) + 1}-{Math.min(page * limit, filteredReservations.length)} de {total} reserva{total !== 1 ? "s" : ""}
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

      {total > limit && (
        <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={goToPage} onLimitChange={setLimit} />
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] max-w-xl gap-0 p-0 overflow-hidden" showCloseButton={false}>
          <DialogHeader className="border-b border-border px-5 py-4 flex-row items-center justify-between gap-2 space-y-0">
            <div className="space-y-1">
              <DialogTitle>Nueva Reserva</DialogTitle>
              <DialogDescription>
                Completa los datos principales de la estadía y confirma la reserva.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsCreateOpen(false)}
              aria-label="Cerrar"
              className="text-muted-foreground hover:text-foreground -mr-2"
            >
              <XIcon />
            </Button>
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
        <DialogContent className="w-[95vw] max-w-xl gap-0 p-0 overflow-hidden" showCloseButton={false}>
          <DialogHeader className="border-b border-border px-5 py-4 flex-row items-center justify-between gap-2 space-y-0">
            <div className="space-y-1">
              <DialogTitle>Editar Reserva</DialogTitle>
              <DialogDescription>
                Ajusta los datos de la estadía manteniendo el registro de cambios.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditingReservation(null)}
              aria-label="Cerrar"
              className="text-muted-foreground hover:text-foreground -mr-2"
            >
              <XIcon />
            </Button>
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

