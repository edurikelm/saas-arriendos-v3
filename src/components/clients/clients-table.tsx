"use client";

import { useState } from "react";
import { Users, Plus, Pencil, Trash2, Search, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientForm } from "@/components/clients/client-form";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  initialClients: Client[];
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

export function ClientsTable({ initialClients }: ClientsTableProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

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
    setClients((prev) => [result.client!, ...prev]);
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
    setClients((prev) =>
      prev.map((c) => (c.id === editingClient.id ? { ...c, ...result.client } : c))
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este cliente?")) return;

    const result = await deleteClient(id);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Cliente eliminado");
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.phone && client.phone.includes(searchQuery)) ||
      (client.rut && client.rut.includes(searchQuery))
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Clientes
              </CardTitle>
              <CardDescription>Gestiona tu cartera de clientes</CardDescription>
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="sm:inline">Nuevo Cliente</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative w-full sm:max-w-sm mb-6">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email, teléfono o RUT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No hay clientes</h3>
              <p className="text-muted-foreground mb-4">Crea tu primer cliente para comenzar</p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Cliente
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {filteredClients.length} de {clients.length} clientes
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-200/70 bg-zinc-950/[0.02] p-2 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-950/30">
              <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm">
                    <thead className="sticky top-0 z-10 bg-zinc-100/90 backdrop-blur dark:bg-zinc-950/90">
                    <tr>
                      <th className="rounded-l-xl px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Nombre</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Email</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Teléfono</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">RUT</th>
                      <th className="px-4 py-3 text-center font-medium text-zinc-600 dark:text-zinc-400">Reservas</th>
                      <th className="rounded-r-xl px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr key={client.id} className="group relative transition-transform duration-200 hover:-translate-y-0.5">
                        <td className="relative rounded-l-xl border-y border-l border-zinc-200/70 bg-white p-4 shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:group-hover:bg-zinc-900/60">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-lg ring-2 ring-white/10">
                              {getInitials(client.name)}
                            </div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{client.name}</span>
                          </div>
                        </td>
                        <td className="border-y border-zinc-200/70 bg-white p-4 text-zinc-600 shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:text-zinc-400 dark:group-hover:bg-zinc-900/60">{client.email}</td>
                        <td className="border-y border-zinc-200/70 bg-white p-4 text-zinc-600 shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:text-zinc-400 dark:group-hover:bg-zinc-900/60">{client.phone || "-"}</td>
                        <td className="border-y border-zinc-200/70 bg-white p-4 text-zinc-600 shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:text-zinc-400 dark:group-hover:bg-zinc-900/60">{client.rut || "-"}</td>
                        <td className="border-y border-zinc-200/70 bg-white p-4 text-center shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:group-hover:bg-zinc-900/60">
                          <Badge variant="secondary" className="text-xs">
                            {client.reservationsCount}
                          </Badge>
                        </td>
                        <td className="rounded-r-xl border-y border-r border-zinc-200/70 bg-white p-4 text-right shadow-sm transition-colors group-hover:bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:group-hover:bg-zinc-900/60">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="cursor-pointer rounded-md p-1.5 hover:bg-muted transition-colors">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingClient(client)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => handleDelete(client.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
    </>
  );
}
