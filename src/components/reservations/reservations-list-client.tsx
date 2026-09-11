"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Plus, X, X as XIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { ReservationTable } from "@/components/reservations/reservation-table";
import { ReservationListItem } from "@/components/reservations/reservation-list-item";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/use-pagination";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useReservationFilters, type ServerReservationFilters } from "@/hooks/use-reservation-filters";
import { FilterPill } from "@/components/ui/filter-pill";
import { FilterChip } from "@/components/ui/filter-chip";
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
  const router = useRouter();

  // Server-fetched reservations (affected by server-side filters)
  const [serverReservations, setServerReservations] = useState<Reservation[]>(initialData.data);
  const [total, setTotal] = useState(initialData.total);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);

  // View mode: mobile always falls back to list (cards), desktop stays on table
  const [viewMode] = useState<"list" | "table">("table");
  const isMobile = useMediaQuery("(max-width: 767px)");

  // Dialogs
  // Modal de creación: inicialización lazy desde URL para soportar deep-link
  // `/reservations?create=true` sin setState-in-effect. La URL se limpia en el
  // effect de abajo; si el usuario abre el modal manualmente después, el botón
  // local sigue funcionando normalmente.
  const [isCreateOpen, setIsCreateOpen] = useState(
    () => searchParams.get("create") === "true"
  );
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [confirmAction, setConfirmAction] = useState<null | {
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }>(null);

  // Pagination
  const { page, limit, goToPage, setLimit } = usePagination({ total, totalPages, defaultPage: 1, defaultLimit: 10 });

  // Server-side filter changes trigger re-fetch
  const fetchReservations = useCallback(async (filters: ServerReservationFilters) => {
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (filters.propertyId) params.append("propertyId", filters.propertyId);
      if (filters.billingType) params.append("billingType", filters.billingType);
      if (filters.status) params.append("status", filters.status);
      if (filters.temporal && filters.temporal !== "all") params.append("temporal", filters.temporal);
      if (filters.payment && filters.payment !== "all") params.append("payment", filters.payment);
      // La búsqueda va al servidor: filtrarla en cliente solo miraba las ≤10
      // filas de la página cargada.
      if (filters.search.trim()) params.append("search", filters.search.trim());
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

  const {
    serverFilters,
    searchQuery,
    debouncedSearch,
    hasActiveFilters,
    updateServerFilter,
    handleSearchChange,
    clearAllFilters,
  } = useReservationFilters({
    onServerFiltersChange: fetchReservations,
    // `initialData` viene de `getReservations({ page: 1, limit: 10 })` sin
    // filtros, que es exactamente con lo que arranca el hook.
    skipInitialFetch: true,
  });

  // Cambiar un filtro vuelve a la página 1: la página 7 de un set no tiene nada
  // que ver con la página 7 de otro.
  //
  // `payment` faltaba en esta lista, así que filtrar por cobranza estando en la
  // página 2 dejaba al usuario en la página 2 del set nuevo — normalmente vacía.
  useEffect(() => {
    if (page !== 1) goToPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    serverFilters.propertyId,
    serverFilters.billingType,
    serverFilters.status,
    serverFilters.temporal,
    serverFilters.payment,
    debouncedSearch,
    goToPage,
  ]);

  // Effective view mode: mobile always uses list
  const effectiveViewMode = isMobile ? "list" : viewMode;

  const rangeStart = serverReservations.length === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = (page - 1) * limit + serverReservations.length;

  // Deep-link from external systems: /reservations?reservationId=abc123 → redirect to detail page.
  // The preview-from-list pattern was removed (list always navigates to detail page directly).
  useEffect(() => {
    const reservationId = searchParams.get("reservationId");
    if (!reservationId) return;
    router.replace(`/reservations/${reservationId}`);
  }, [searchParams, router]);

  // Deep-link: /reservations?create=true → limpia la URL para evitar reabrir el
  // modal al refrescar. El state inicial ya se setea vía useState lazy arriba,
  // así este effect solo hace side-effect de URL (sin setState).
  //
  // Edge case documentado: si la URL trae `?create=true` junto con otros params
  // (ej. `?reservationId=abc`), este effect corre antes que el de `reservationId`
  // y limpia solo `create`, preservando los demás. En ese caso el modal abre y
  // luego la navegación a `/reservations/{id}` se ejecuta desde el effect de
  // arriba (orden de declaración de hooks). Si en el futuro se quiere
  // priorizar `create` sobre `reservationId`, reordernar los effects.
  useEffect(() => {
    if (searchParams.get("create") !== "true") return;
    const cleaned = new URLSearchParams(searchParams.toString());
    cleaned.delete("create");
    const next = cleaned.toString();
    router.replace(next ? `/reservations?${next}` : "/reservations", { scroll: false });
  }, [searchParams, router]);

  // CRUD handlers
  const handleRefresh = useCallback(async () => {
    // Refrescar tiene que respetar la búsqueda activa, o al crear/cancelar una
    // reserva la lista volvería sin filtrar.
    await fetchReservations({ ...serverFilters, search: debouncedSearch });
  }, [fetchReservations, serverFilters, debouncedSearch]);

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
          <h1 className="text-xl font-bold text-foreground">Reservas</h1>
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
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                aria-label="Buscar reservas"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar por nombre, propiedad o palabra clave..."
                className="h-10 w-full rounded-lg border border-border bg-card pl-12 pr-4 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-all focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:border-ring"
              />
            </div>

            {/* Filter Chips Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Los dos controles binarios van juntos y con más aire entre sí
                  que el resto: con el gap-2 de la fila quedaban a 8px y se leían
                  como un solo control de siete opciones. El gap va en el
                  contenedor y no como margen del segundo, porque al envolver en
                  móvil un margen dejaba al segundo grupo con sangría suelta. */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Vista temporal. Va primero porque decide QUÉ porción se mira;
                    los chips que siguen la acotan. Es server-side, así que
                    respeta la paginación en vez de recortar la página cargada. */}
                <FilterPill
                  ariaLabel="Vista temporal"
                  value={serverFilters.temporal}
                  onChange={(v) => updateServerFilter("temporal", v)}
                  options={[
                    { value: "all", label: "Todas" },
                    { value: "active", label: "Activas" },
                    { value: "upcoming", label: "Próximas" },
                    { value: "past", label: "Terminadas" },
                  ]}
                />


                {/* Tipo de arriendo. Era un dropdown para un binario: tres clics
                    (abrir, elegir, cerrar) para algo que cabe en uno. Un
                    segmented control lo resuelve en un clic y además deja el
                    estado a la vista sin abrir nada. */}
                <FilterPill
                  ariaLabel="Tipo de arriendo"
                  value={serverFilters.billingType || "all"}
                  onChange={(v) => updateServerFilter("billingType", v === "all" ? "" : v)}
                  options={[
                    { value: "all", label: "Ambos" },
                    { value: "DAILY", label: "Diaria" },
                    { value: "MONTHLY", label: "Mensual" },
                  ]}
                />
              </div>

              {/* Los dos segmented controls son las dimensiones binarias que
                  se miran de un vistazo. Los dropdowns que siguen son para lo
                  que no cabe en pills: la propiedad crece con el catálogo, y
                  los otros dos tienen más opciones. */}
              <div className="mx-1 h-4 w-px bg-border" />

              {/* Propiedad */}
              <FilterChip
                label="Propiedad"
                value={serverFilters.propertyId}
                valueLabel={properties.find((p) => p.id === serverFilters.propertyId)?.name ?? "—"}
                valueMaxWidth="max-w-[140px]"
                clearAriaLabel="Quitar filtro de propiedad"
                onClear={() => updateServerFilter("propertyId", "")}
              >
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
              </FilterChip>


              {/* Estado */}
              {/* Confirmación. Antes este chip se llamaba "Estado" y filtraba el
                  ciclo de vida (PENDING/CONFIRMED/CANCELLED/COMPLETED) mientras
                  la columna del mismo nombre muestra el estado TEMPORAL — así que
                  "Confirmada" no correspondía a ningún valor visible, y en
                  producción "Cancelada" y "Completada" no matcheaban nada. Lo
                  temporal se fue al toggle (que ahora incluye "Terminadas") y acá
                  queda lo único que el toggle no cubre: si la reserva está
                  confirmada o no. */}
              <FilterChip
                label="Confirmación"
                value={serverFilters.status}
                valueLabel={serverFilters.status === "PENDING" ? "Sin confirmar" : "Confirmadas"}
                clearAriaLabel="Quitar filtro de confirmación"
                onClear={() => updateServerFilter("status", "")}
              >
                <DropdownMenuContent className="ring-1 ring-foreground/10">
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("status", "")}
                    className={!serverFilters.status ? "bg-accent" : ""}
                  >
                    Todas
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("status", "PENDING")}
                    className={serverFilters.status === "PENDING" ? "bg-accent" : ""}
                  >
                    Sin confirmar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("status", "CONFIRMED")}
                    className={serverFilters.status === "CONFIRMED" ? "bg-accent" : ""}
                  >
                    Confirmadas
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </FilterChip>


              {/* Cobranza. Las dos opciones son las que Prisma puede resolver como
                  filtro de relación, o sea en el servidor y respetando la
                  paginación. Las anteriores (Pagado / Pendiente / Exceso)
                  comparaban la suma de pagos contra el total —un agregado que no
                  se puede filtrar en la base sin denormalizar— y se aplicaban en
                  el cliente sobre las ≤10 filas cargadas. "Exceso", además, no
                  ocurre nunca en producción. */}
              <FilterChip
                label="Cobranza"
                value={serverFilters.payment === "all" ? "" : serverFilters.payment}
                valueLabel={serverFilters.payment === "unpaid" ? "Sin abonos" : "Con vencidas"}
                clearAriaLabel="Quitar filtro de cobranza"
                onClear={() => updateServerFilter("payment", "all")}
              >
                <DropdownMenuContent className="ring-1 ring-foreground/10">
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("payment", "all")}
                    className={serverFilters.payment === "all" ? "bg-accent" : ""}
                  >
                    Toda la cobranza
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("payment", "overdue")}
                    className={serverFilters.payment === "overdue" ? "bg-accent" : ""}
                  >
                    Con cuotas vencidas
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => updateServerFilter("payment", "unpaid")}
                    className={serverFilters.payment === "unpaid" ? "bg-accent" : ""}
                  >
                    Sin abonos
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </FilterChip>

              {/* El divisor vive con el botón: dibujado siempre, dejaba un `|`
                  suelto al final de la fila cuando no había nada que limpiar
                  — y en móvil, envuelto, colgando solo en su propia línea. */}
              {hasActiveFilters && (
                <>
                  <div className="mx-1 h-4 w-px bg-border" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-8 px-3 text-xs font-bold text-muted-foreground hover:text-destructive-text transition-colors"
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Limpiar filtros
                </Button>
                </>
              )}
            </div>
          </div>

          {/* Counter + Pagination (top) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground tabular-nums">
              {/*
                El rango tiene que salir del offset de la página MÁS cuántas filas
                se están dibujando. La versión anterior era
                `Math.min(page * limit, serverReservations.length)`, que mezcla
                un offset global con el largo de la página actual: en la página 2
                imprimía "Mostrando 11-10 de 24 reservas", con el rango al revés.

                Y mientras haya un filtro de cliente (búsqueda o pago) el rango
                no aplica: esos filtros recortan solo la página que está cargada,
                así que "de {total}" — el total del servidor sin filtrar — no
                describe lo que se ve. Ahí el contador dice lo que sí es cierto.
              */}
              {/* Ya no hay filtros de página: todos viajan al servidor, así que
                  el rango siempre describe lo que se ve. El empty state de abajo
                  se encarga del caso sin resultados — un "0-0 de 0" sería ruido. */}
              {serverReservations.length === 0
                ? null
                : `Mostrando ${rangeStart}-${rangeEnd} de ${total} reserva${total !== 1 ? "s" : ""}`}
            </div>
            {total > limit && (
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={limit}
                onPageChange={goToPage}
                onLimitChange={setLimit}
                showCounter={false}
              />
            )}
          </div>

          {serverReservations.length === 0 ? (
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
              <ReservationTable
                reservations={serverReservations}
                onEdit={(id) => {
                  const res = serverReservations.find((r) => r.id === id);
                  if (res) setEditingReservation(res);
                }}
                onCancel={(id) => handleCancel(id)}
                onDelete={(id) => handleDelete(id)}
              />
          ) : (
            /*
              Un contenedor con filas divididas, no una card por reserva. Ocho
              cards apiladas repetían ocho marcos para un solo objeto; el mismo
              framing que usa `DataTable` en desktop (accent strip + borde) hace
              que la lista se lea como la misma tabla en otro ancho, y le
              devuelve al contenido la altura que gastaban los marcos.
            */
            <div className="overflow-hidden rounded-md border border-t-2 border-border border-t-primary bg-card">
              {serverReservations.map((reservation) => (
                <ReservationListItem
                  key={reservation.id}
                  reservation={reservation}
                  onEdit={(res) => setEditingReservation(res)}
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
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


