"use client";

import { useState, useEffect } from "react";
import { Users, Shield, Trash2, Search, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  name: string;
  plan: string;
  role: string;
  createdAt: string;
  _count: {
    properties: number;
    clients: number;
    reservations: number;
  };
}

interface UserStats {
  properties: number;
  clients: number;
  reservations: number;
  totalRevenue: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", name: "", plan: "FREE" as "FREE" | "PRO" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [page, search, planFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });

      if (search) params.append("search", search);
      if (planFilter !== "all") params.append("plan", planFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) {
        toast.error("Error al cargar usuarios");
        return;
      }
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (user: User) => {
    setSelectedUser(user);
    try {
      const res = await fetch(`/api/admin/users?userId=${user.id}`);
      if (!res.ok) {
        toast.error("Error al cargar datos del usuario");
        return;
      }
      const data = await res.json();
      setUserStats(data);
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleUpdatePlan = async (userId: string, plan: string) => {
    try {
      const res = await fetch(`/api/admin/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, plan }),
      });

      if (!res.ok) {
        toast.error("Error al actualizar plan");
        return;
      }

      toast.success("Plan actualizado correctamente");
      fetchUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, plan });
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Error al eliminar usuario");
        return;
      }

      toast.success("Usuario eliminado");
      setShowDeleteDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleCreateOwner = async () => {
    if (!createForm.email || !createForm.password || !createForm.name) {
      toast.error("Todos los campos son requeridos");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Error al crear propietario");
        return;
      }

      toast.success("Propietario creado correctamente");
      setShowCreateDialog(false);
      setCreateForm({ email: "", password: "", name: "", plan: "FREE" });
      fetchUsers();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Admin</h1>
          <p className="text-sm text-muted-foreground">Gestión de usuarios del sistema</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuarios
              </CardTitle>
              <CardDescription>Total: {total} usuarios registrados</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Propietario
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por email o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={planFilter} onValueChange={(v) => setPlanFilter(v || "all")}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="FREE">Free</SelectItem>
                <SelectItem value="PRO">Pro</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-medium">Usuario</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Plan</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Propiedades</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Clientes</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Reservas</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              user.plan === "ENTERPRISE"
                                ? "default"
                                : user.plan === "PRO"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {user.plan}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">{user._count.properties}</td>
                        <td className="px-4 py-3 text-sm">{user._count.clients}</td>
                        <td className="px-4 py-3 text-sm">{user._count.reservations}</td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSelectUser(user)}
                          >
                            Ver
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          No se encontraron usuarios
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {total > 20 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} de {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page * 20 >= total}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedUser.name}</DialogTitle>
              <DialogDescription>{selectedUser.email}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plan actual</span>
                <Select
                  value={selectedUser.plan}
                  onValueChange={(v) => handleUpdatePlan(selectedUser.id, v || "FREE")}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">Free</SelectItem>
                    <SelectItem value="PRO">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Propiedades</p>
                  <p className="text-lg font-semibold">{selectedUser._count.properties}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Clientes</p>
                  <p className="text-lg font-semibold">{userStats?.clients ?? selectedUser._count.clients ?? 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reservas</p>
                  <p className="text-lg font-semibold">{selectedUser._count.reservations}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ingresos</p>
                  <p className="text-lg font-semibold">
                    {userStats?.totalRevenue.toLocaleString("CLP") || "0"}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar usuario
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar usuario?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará al usuario y todos sus datos. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedUser && handleDeleteUser(selectedUser.id)}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Propietario</DialogTitle>
            <DialogDescription>
              Ingresa los datos del nuevo propietario
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Select value={createForm.plan} onValueChange={(v) => setCreateForm({ ...createForm, plan: v as "FREE" | "PRO" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Free</SelectItem>
                  <SelectItem value="PRO">Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateOwner} disabled={creating}>
              {creating ? "Creando..." : "Crear Propietario"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}