"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, X, MoreHorizontal, Users, UserCheck, UserPlus, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ClientForm } from "@/components/clients/client-form";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/pagination";
import { usePagination } from "@/hooks/use-pagination";
import type { PaginatedResponse } from "@/types/pagination";
import type { ClientsKpis } from "@/lib/actions/clients";
import { toast } from "sonner";
import { createClient, updateClient, deleteClient } from "@/lib/actions/clients";
import type { ClientInput } from "@/lib/validations/client";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  rut: string | null;
  notes: string | null;
  reservationsCount?: number;
  createdAt: Date | string;
  userId?: string;
}

interface ClientsTableProps {
  initialData: PaginatedResponse<Client>;
  kpis?: ClientsKpis;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ClientsTable({ initialData, kpis }: ClientsTableProps) {
  const [clients, setClients] = useState<Client[]>(initialData.data);
  const [total, setTotal] = useState(initialData.total);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const { page, limit, goToPage, setLimit, range } = usePagination({
    total,
    totalPages,
    defaultPage: initialData.page,
    defaultLimit: 10,
  });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (searchQuery) params.append("search", searchQuery);
      const res = await fetch(`/api/clients?${params}`);
      const data: PaginatedResponse<Client> = await res.json();
      setClients(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on dependency change
    fetchClients();
  }, [page, limit, fetchClients]);

  useEffect(() => {
    const timer = setTimeout(() => {
      goToPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, goToPage]);

  const handleCreate = async (data: ClientInput) => {
    const result = await createClient(data);

    if (result.error) {
      if (result.upgrade) {
        toast.error(result.error);
        return;
      }
      toast.error(result.error);
      return;
    }

    toast.success("Cliente creado correctamente");
    setIsCreateOpen(false);
    fetchClients();
  };

  const handleUpdate = async (data: ClientInput) => {
    if (!editingClient) return;

    const result = await updateClient(editingClient.id, data);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Cliente actualizado correctamente");
    setEditingClient(null);
    fetchClients();
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;

    const result = await deleteClient(clientToDelete.id);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Cliente eliminado");
    setClientToDelete(null);
    fetchClients();
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
            <h1 className="text-xl font-bold tracking-tight">Clientes</h1>
            <p className="text-xs text-muted-foreground">
              Directorio centralizado de huéspedes y clientes recurrentes
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            <span>Nuevo Cliente</span>
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total de Clientes"
            value={kpis?.total ?? 0}
            icon={Users}
            tone="default"
            sublabel="En tu directorio"
          />
          <KpiCard
            label="Clientes Activos"
            value={kpis?.active ?? 0}
            icon={UserCheck}
            tone="success"
            sublabel="Con reservas registradas"
          />
          <KpiCard
            label="Sin Reservas"
            value={kpis?.withoutReservations ?? 0}
            icon={UserX}
            tone="warning"
            sublabel="Aún sin actividad"
          />
          <KpiCard
            label="Nuevos este Mes"
            value={kpis?.newThisMonth ?? 0}
            icon={UserPlus}
            tone="info"
            sublabel="Registrados recientemente"
          />
        </div>

        {/* Search bar full-width */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email, teléfono o RUT..."
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
        {clients.length === 0 && !loading ? (
          <DataTable
            headers={["Cliente", "Teléfono", "Documento", "Reservas", "Acciones"]}
            caption="Lista de clientes"
            emptyState={
              <div className="space-y-3">
                <p className="text-sm font-medium">No hay clientes</p>
                <p className="text-xs text-muted-foreground">
                  {hasActiveFilters
                    ? "Ningun cliente coincide con tu búsqueda"
                    : "Crea tu primer cliente para comenzar"}
                </p>
                {!hasActiveFilters && (
                  <Button onClick={() => setIsCreateOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Cliente
                  </Button>
                )}
              </div>
            }
          >
            {null}
          </DataTable>
        ) : (
          <>
            <DataTable
              headers={["Cliente", "Teléfono", "Documento", "Reservas", "Acciones"]}
              caption="Lista de clientes"
            >
              {clients.map((client) => (
                <tr key={client.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {getInitials(client.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{client.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{client.phone || "—"}</td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{client.rut || "—"}</td>
                  <td className="px-6 py-4 text-center">
                    <Badge variant="secondary" className="text-xs">
                      {client.reservationsCount ?? 0}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="cursor-pointer rounded-md p-1.5 hover:bg-muted transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingClient(client)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setClientToDelete(client)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
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
              itemLabel="clientes"
              onPageChange={goToPage}
              onLimitChange={setLimit}
            />
          </>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <ClientForm
            onSubmit={handleCreate}
            onCancel={() => setIsCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
        <DialogContent className="w-[95vw] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          {editingClient && (
            <ClientForm
              initialData={{
                name: editingClient.name,
                email: editingClient.email,
                phone: editingClient.phone || undefined,
                rut: editingClient.rut || undefined,
                notes: editingClient.notes || undefined,
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingClient(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!clientToDelete}
        onOpenChange={(open) => {
          if (!open) setClientToDelete(null);
        }}
        title="Eliminar cliente"
        description={`Se eliminará ${clientToDelete?.name ?? "este cliente"}. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar cliente"
        onConfirm={handleDelete}
      />
    </>
  );
}