"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  MoreHorizontal,
  Handshake,
  UserCheck,
  BookOpen,
  Percent,
  Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BrokerForm } from "@/components/brokers/broker-form";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/use-pagination";
import type { PaginatedResponse } from "@/types/pagination";
import type { BrokersKpis, BrokerRow } from "@/lib/actions/brokers";
import { toast } from "sonner";
import {
  createBroker,
  updateBroker,
  deleteBroker,
  setBrokerActive,
} from "@/lib/actions/brokers";
import type { BrokerInput } from "@/lib/validations/broker";

interface BrokersTableProps {
  initialData: PaginatedResponse<BrokerRow>;
  kpis?: BrokersKpis;
}

const HEADERS = ["Captador", "Teléfono", "Comisión", "Reservas", "Estado", "Acciones"];

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/** `10` → "10%", `8.5` → "8,5%". Sin decimales cuando son cero. */
function formatRate(rate: number): string {
  return `${rate.toLocaleString("es-CL", { maximumFractionDigits: 2 })}%`;
}

export function BrokersTable({ initialData, kpis }: BrokersTableProps) {
  const [brokers, setBrokers] = useState<BrokerRow[]>(initialData.data);
  const [total, setTotal] = useState(initialData.total);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState<BrokerRow | null>(null);
  const [brokerToDelete, setBrokerToDelete] = useState<BrokerRow | null>(null);

  const { page, limit, goToPage, setLimit } = usePagination({
    total,
    totalPages,
    defaultPage: initialData.page,
    defaultLimit: 10,
  });

  const fetchBrokers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (searchQuery) params.append("search", searchQuery);
      const res = await fetch(`/api/brokers?${params}`);
      const data: PaginatedResponse<BrokerRow> = await res.json();
      setBrokers(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on dependency change
    fetchBrokers();
  }, [page, limit, fetchBrokers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      goToPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, goToPage]);

  const handleCreate = async (data: BrokerInput) => {
    const result = await createBroker(data);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Captador creado correctamente");
    setIsCreateOpen(false);
    fetchBrokers();
  };

  const handleUpdate = async (data: BrokerInput) => {
    if (!editingBroker) return;

    const result = await updateBroker(editingBroker.id, data);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Captador actualizado correctamente");
    setEditingBroker(null);
    fetchBrokers();
  };

  const handleToggleActive = async (broker: BrokerRow) => {
    const result = await setBrokerActive(broker.id, !broker.active);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(broker.active ? "Captador desactivado" : "Captador activado");
    fetchBrokers();
  };

  const handleDelete = async () => {
    if (!brokerToDelete) return;

    const result = await deleteBroker(brokerToDelete.id);

    if (result.error) {
      toast.error(result.error);
      setBrokerToDelete(null);
      return;
    }

    toast.success("Captador eliminado");
    setBrokerToDelete(null);
    fetchBrokers();
  };

  const hasActiveFilters = searchQuery.length > 0;

  const handleClearFilters = () => {
    setSearchQuery("");
    goToPage(1);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Captadores</h1>
            <p className="text-xs text-muted-foreground">
              Quiénes te consiguen arrendatarios y qué porcentaje se llevan
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            <span>Nuevo Captador</span>
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total de Captadores"
            value={kpis?.total ?? 0}
            icon={Handshake}
            tone="default"
            sublabel="En tu equipo"
          />
          <KpiCard
            label="Activos"
            value={kpis?.active ?? 0}
            icon={UserCheck}
            tone="success"
            sublabel="Disponibles para asignar"
          />
          <KpiCard
            label="Reservas Captadas"
            value={kpis?.reservationsBrought ?? 0}
            icon={BookOpen}
            tone="info"
            sublabel="Histórico, todas las reservas"
          />
          <KpiCard
            label="Comisión Promedio"
            value={formatRate(kpis?.averageRate ?? 0)}
            icon={Percent}
            tone="default"
            sublabel="Entre los activos"
          />
        </div>

        {/* Search bar full-width */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters row */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              Búsqueda: {searchQuery}
            </span>
            <div className="h-4 w-px bg-border mx-1" />
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-7 text-xs">
              <X className="h-3.5 w-3.5 mr-1" />
              Limpiar filtros
            </Button>
          </div>
        )}

        {/* Table */}
        {brokers.length === 0 && !loading ? (
          <DataTable
            headers={HEADERS}
            caption="Lista de captadores"
            emptyState={
              <div className="space-y-3">
                <p className="text-sm font-medium">No hay captadores</p>
                <p className="text-xs text-muted-foreground">
                  {hasActiveFilters
                    ? "Ningún captador coincide con tu búsqueda"
                    : "Registra a quien te consigue arrendatarios para llevarle la comisión"}
                </p>
                {!hasActiveFilters && (
                  <Button onClick={() => setIsCreateOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Captador
                  </Button>
                )}
              </div>
            }
          >
            {null}
          </DataTable>
        ) : (
          <>
            <DataTable headers={HEADERS} caption="Lista de captadores">
              {brokers.map((broker) => (
                <tr
                  key={broker.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {getInitials(broker.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">
                          {broker.name}
                        </p>
                        {/* Sin email ni RUT no va segunda línea: el teléfono
                            tiene su propia columna y un "sin contacto" acá
                            mentiría cuando esa columna está llena. */}
                        {(broker.email || broker.rut) && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {broker.email || broker.rut}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {broker.phone || "—"}
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-foreground">
                    {formatRate(broker.defaultCommissionRate)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge variant="secondary" className="text-xs">
                      {broker.reservationsCount}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={broker.active ? "success" : "outline"} className="text-xs">
                      {broker.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="cursor-pointer rounded-md p-1.5 hover:bg-muted transition-colors"
                        aria-label={`Más acciones para ${broker.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingBroker(broker)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(broker)}>
                          <Power className="h-4 w-4 mr-2" />
                          {broker.active ? "Desactivar" : "Activar"}
                        </DropdownMenuItem>
                        {broker.reservationsCount === 0 && (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setBrokerToDelete(broker)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </DataTable>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              itemLabel="captadores"
              onPageChange={goToPage}
              onLimitChange={setLimit}
            />
          </>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nuevo Captador</DialogTitle>
          </DialogHeader>
          <BrokerForm onSubmit={handleCreate} onCancel={() => setIsCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingBroker} onOpenChange={() => setEditingBroker(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Captador</DialogTitle>
          </DialogHeader>
          {editingBroker && (
            <BrokerForm
              initialData={{
                name: editingBroker.name,
                email: editingBroker.email || undefined,
                phone: editingBroker.phone || undefined,
                rut: editingBroker.rut || undefined,
                defaultCommissionRate: editingBroker.defaultCommissionRate,
                notes: editingBroker.notes || undefined,
              }}
              hasReservations={editingBroker.reservationsCount > 0}
              onSubmit={handleUpdate}
              onCancel={() => setEditingBroker(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!brokerToDelete}
        onOpenChange={(open) => {
          if (!open) setBrokerToDelete(null);
        }}
        title="Eliminar captador"
        description={`Se eliminará ${brokerToDelete?.name ?? "este captador"}. No tiene reservas asociadas, así que no se pierde ningún registro de comisiones.`}
        confirmLabel="Eliminar captador"
        onConfirm={handleDelete}
      />
    </>
  );
}
