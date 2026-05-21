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
          <div className="relative max-w-sm mb-6">
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
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="text-left p-4 font-medium text-zinc-600 dark:text-zinc-400">Nombre</th>
                      <th className="text-left p-4 font-medium text-zinc-600 dark:text-zinc-400">Email</th>
                      <th className="text-left p-4 font-medium text-zinc-600 dark:text-zinc-400">Teléfono</th>
                      <th className="text-left p-4 font-medium text-zinc-600 dark:text-zinc-400">RUT</th>
                      <th className="text-center p-4 font-medium text-zinc-600 dark:text-zinc-400">Reservas</th>
                      <th className="text-right p-4 font-medium text-zinc-600 dark:text-zinc-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredClients.map((client) => (
                      <tr key={client.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-medium">
                              {client.name[0]}
                            </div>
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{client.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-zinc-600 dark:text-zinc-400">{client.email}</td>
                        <td className="p-4 text-zinc-600 dark:text-zinc-400">{client.phone || "-"}</td>
                        <td className="p-4 text-zinc-600 dark:text-zinc-400">{client.rut || "-"}</td>
                        <td className="p-4 text-center">
                          <Badge variant="secondary" className="text-xs">
                            {client.reservationsCount}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
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
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
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
        <DialogContent className="sm:max-w-[425px]">
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
