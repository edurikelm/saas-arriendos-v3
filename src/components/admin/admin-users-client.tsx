"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Users, Trash2, Search, Plus, ChevronDown, ChevronUp, X, Download, Ban, CheckCircle, XCircle, UserPlus, Sparkles, UserRound } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HealthBadge } from "@/components/admin/health-badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { updateUserPlan, updateUserStatus, deleteUser, createOwner } from "@/lib/actions/super-admin";
import type { AdminUsersKpis } from "@/lib/actions/super-admin";

interface User {
  id: string;
  email: string;
  name: string | null;
  plan: string | null;
  role: string;
  status: string;
  createdAt: string | Date;
  _count: {
    properties: number;
    clients: number;
    reservations: number;
  };
  isMpConnected?: boolean;
  hasOverduePayments?: boolean;
}

interface UserStats {
  properties: number;
  clients: number;
  reservations: number;
  totalRevenue: number;
}

type HealthSeverity = "critical" | "warning" | "limit" | "healthy";

interface HealthIndicator {
  label: string;
  severity: HealthSeverity;
}

function getHealthIndicators(user: User): HealthIndicator[] {
  const indicators: HealthIndicator[] = [];

  if (user._count.properties === 0) {
    indicators.push({ label: "Sin propiedades", severity: "critical" });
  }
  if (user._count.reservations === 0) {
    indicators.push({ label: "Sin reservas", severity: "warning" });
  }
  if (!user.isMpConnected) {
    indicators.push({ label: "MP desconectado", severity: "warning" });
  }
  if (user.plan === "FREE" && user._count.properties >= 3) {
    indicators.push({ label: "Al límite FREE", severity: "limit" });
  }
  if (user.hasOverduePayments) {
    indicators.push({ label: "Pagos vencidos", severity: "critical" });
  }

  if (indicators.length === 0) {
    indicators.push({ label: "Activo", severity: "healthy" });
  }

  return indicators;
}

interface AdminUsersClientProps {
  initialUsers: User[];
  initialTotal: number;
  kpis?: AdminUsersKpis;
}

const planFilterLabels: Record<string, string> = {
  all: "Todos",
  FREE: "Free",
  PRO: "Pro",
};

function getInitials(name: string | null, email: string): string {
  const base = name?.trim() || email.split("@")[0] || email;
  const parts = base.split(/[\s._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

import Link from "next/link";

export function AdminUsersClient({ initialUsers, initialTotal, kpis }: AdminUsersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [planFilter, setPlanFilter] = useState(searchParams.get("plan") || "all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [noProperties, setNoProperties] = useState(searchParams.get("noProperties") === "true");
  const [noReservations, setNoReservations] = useState(searchParams.get("noReservations") === "true");
  const [mpDisconnected, setMpDisconnected] = useState(searchParams.get("mpDisconnected") === "true");
  const [pendingPayments, setPendingPayments] = useState(searchParams.get("pendingPayments") === "true");
  const [overduePayments, setOverduePayments] = useState(searchParams.get("overduePayments") === "true");
  const [createdFrom, setCreatedFrom] = useState(searchParams.get("createdFrom") || "");
  const [createdTo, setCreatedTo] = useState(searchParams.get("createdTo") || "");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", name: "", plan: "FREE" as "FREE" | "PRO" });
  const [creating, setCreating] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  const updateURL = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (planFilter !== "all") params.set("plan", planFilter);
    if (noProperties) params.set("noProperties", "true");
    if (noReservations) params.set("noReservations", "true");
    if (mpDisconnected) params.set("mpDisconnected", "true");
    if (pendingPayments) params.set("pendingPayments", "true");
    if (overduePayments) params.set("overduePayments", "true");
    if (createdFrom) params.set("createdFrom", createdFrom);
    if (createdTo) params.set("createdTo", createdTo);
    router.push(`/admin/users?${params.toString()}`, { scroll: false });
  }, [search, planFilter, noProperties, noReservations, mpDisconnected, pendingPayments, overduePayments, createdFrom, createdTo, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });

      if (search) params.append("search", search);
      if (planFilter !== "all") params.append("plan", planFilter);
      if (noProperties) params.append("noProperties", "true");
      if (noReservations) params.append("noReservations", "true");
      if (mpDisconnected) params.append("mpDisconnected", "true");
      if (pendingPayments) params.append("pendingPayments", "true");
      if (overduePayments) params.append("overduePayments", "true");
      if (createdFrom) params.append("createdFrom", createdFrom);
      if (createdTo) params.append("createdTo", createdTo);

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
  }, [page, search, planFilter, noProperties, noReservations, mpDisconnected, pendingPayments, overduePayments, createdFrom, createdTo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on dependency change
    fetchUsers();
  }, [fetchUsers]);

  const clearFilters = () => {
    setSearch("");
    setPlanFilter("all");
    setNoProperties(false);
    setNoReservations(false);
    setMpDisconnected(false);
    setPendingPayments(false);
    setOverduePayments(false);
    setCreatedFrom("");
    setCreatedTo("");
  };

  const hasActiveFilters = search || planFilter !== "all" || noProperties || noReservations || mpDisconnected || pendingPayments || overduePayments || createdFrom || createdTo;

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
      const result = await updateUserPlan({ userId, plan: plan as "FREE" | "PRO" });

      if (result.error) {
        toast.error(result.error);
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

  const handleUpdateStatus = async (userId: string, status: string) => {
    try {
      const result = await updateUserStatus({ userId, status: status as "ACTIVE" | "SUSPENDED" | "CANCELLED" });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Estado actualizado correctamente");
      fetchUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, status });
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const result = await deleteUser(userId, confirmEmail);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Usuario eliminado");
      setShowDeleteDialog(false);
      setConfirmEmail("");
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
      const result = await createOwner(createForm);

      if (result.error) {
        toast.error(result.error);
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

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (planFilter !== "all") params.set("plan", planFilter);
    if (noProperties) params.set("noProperties", "true");
    if (noReservations) params.set("noReservations", "true");
    if (mpDisconnected) params.set("mpDisconnected", "true");
    if (pendingPayments) params.set("pendingPayments", "true");
    if (overduePayments) params.set("overduePayments", "true");
    if (createdFrom) params.set("createdFrom", createdFrom);
    if (createdTo) params.set("createdTo", createdTo);

    window.location.href = `/api/admin/users/export?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Usuarios</h1>
          <p className="text-xs text-muted-foreground">
            Gestión de propietarios del sistema
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Propietario
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total de Propietarios"
          value={kpis?.total ?? total}
          icon={Users}
          tone="default"
          sublabel="Registrados en el sistema"
        />
        <KpiCard
          label="Plan PRO"
          value={kpis?.pro ?? 0}
          icon={Sparkles}
          tone="success"
          sublabel={
            kpis && kpis.total > 0
              ? `${Math.round((kpis.pro / kpis.total) * 100)}% de conversión`
              : "Suscripciones activas"
          }
        />
        <KpiCard
          label="Plan FREE"
          value={kpis?.free ?? 0}
          icon={UserRound}
          tone="default"
          sublabel="En plan gratuito"
        />
        <KpiCard
          label="Nuevos este Mes"
          value={kpis?.newThisMonth ?? 0}
          icon={UserPlus}
          tone="info"
          sublabel="Altas recientes"
        />
      </div>

      {/* Filters */}
      <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
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
                <SelectValue placeholder="Plan">
                  {(value: string) => planFilterLabels[value] ?? "Todos"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="FREE">Free</SelectItem>
                <SelectItem value="PRO">Pro</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="gap-2"
            >
              {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showAdvancedFilters ? "Ocultar" : "Más filtros"}
            </Button>
          </div>

          {showAdvancedFilters && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">Filtros avanzados</h3>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs gap-1">
                    <X className="h-3 w-3" />
                    Limpiar
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="noProperties"
                    checked={noProperties}
                    onCheckedChange={(checked) => setNoProperties(checked === true)}
                  />
                  <label htmlFor="noProperties" className="text-sm cursor-pointer">Sin propiedades</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="noReservations"
                    checked={noReservations}
                    onCheckedChange={(checked) => setNoReservations(checked === true)}
                  />
                  <label htmlFor="noReservations" className="text-sm cursor-pointer">Sin reservas</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="mpDisconnected"
                    checked={mpDisconnected}
                    onCheckedChange={(checked) => setMpDisconnected(checked === true)}
                  />
                  <label htmlFor="mpDisconnected" className="text-sm cursor-pointer">MP desconectado</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pendingPayments"
                    checked={pendingPayments}
                    onCheckedChange={(checked) => setPendingPayments(checked === true)}
                  />
                  <label htmlFor="pendingPayments" className="text-sm cursor-pointer">Pagos pendientes</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="overduePayments"
                    checked={overduePayments}
                    onCheckedChange={(checked) => setOverduePayments(checked === true)}
                  />
                  <label htmlFor="overduePayments" className="text-sm cursor-pointer">Pagos vencidos</label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="space-y-1">
                  <label htmlFor="createdFrom" className="text-xs text-muted-foreground">Fecha inicio</label>
                  <Input
                    id="createdFrom"
                    type="date"
                    value={createdFrom}
                    onChange={(e) => setCreatedFrom(e.target.value)}
                    placeholder="Fecha inicio"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="createdTo" className="text-xs text-muted-foreground">Fecha fin</label>
                  <Input
                    id="createdTo"
                    type="date"
                    value={createdTo}
                    onChange={(e) => setCreatedTo(e.target.value)}
                    placeholder="Fecha fin"
                  />
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <DataTable
                headers={[
                  "Usuario",
                  "Estado",
                  "Plan",
                  "Salud",
                  { label: "Propiedades", align: "center" },
                  { label: "Clientes", align: "center" },
                  { label: "Reservas", align: "center" },
                  { label: "Acciones", align: "right" },
                ]}
                emptyState={<div className="py-8 text-center text-muted-foreground">No se encontraron usuarios</div>}
              >
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {getInitials(user.name, user.email)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{user.name || user.email}</p>
                          {user.name && (
                            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          user.status === "ACTIVE"
                            ? "default"
                            : user.status === "SUSPENDED"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          user.plan === "PRO"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {user.plan}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {getHealthIndicators(user).map((indicator) => {
                          const statusMap: Record<HealthSeverity, "healthy" | "attention" | "overdue" | "dormant"> = {
                            healthy: "healthy",
                            warning: "attention",
                            critical: "overdue",
                            limit: "dormant",
                          };
                          return (
                            <HealthBadge
                              key={indicator.label}
                              status={statusMap[indicator.severity]}
                            >
                              {indicator.label}
                            </HealthBadge>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center tabular-nums">{user._count.properties}</td>
                    <td className="px-6 py-4 text-center tabular-nums">{user._count.clients}</td>
                    <td className="px-6 py-4 text-center tabular-nums">{user._count.reservations}</td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/admin/users/${user.id}`} />}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </DataTable>

              <Pagination
                page={page}
                totalPages={Math.ceil(total / 20)}
                total={total}
                limit={20}
                itemLabel="propietarios"
                onPageChange={setPage}
              />
            </>
          )}
        </div>

      {selectedUser && (
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="w-[95vw] max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedUser.name}</DialogTitle>
              <DialogDescription>{selectedUser.email}</DialogDescription>
            </DialogHeader>

<div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estado</span>
                <Select
                  value={selectedUser.status}
                  onValueChange={(v) => handleUpdateStatus(selectedUser.id, v || "ACTIVE")}
                >
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Activo</SelectItem>
                    <SelectItem value="SUSPENDED">Suspendido</SelectItem>
                    <SelectItem value="CANCELLED">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plan actual</span>
                <Select
                  value={selectedUser.plan}
                  onValueChange={(v) => handleUpdatePlan(selectedUser.id, v || "FREE")}
                >
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">Free</SelectItem>
                    <SelectItem value="PRO">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedUser.status !== "ACTIVE" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedUser.id, "ACTIVE")}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Reactivar
                  </Button>
                )}
                {selectedUser.status !== "SUSPENDED" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedUser.id, "SUSPENDED")}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Suspender
                  </Button>
                )}
                {selectedUser.status !== "CANCELLED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedUser.id, "CANCELLED")}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar cuenta
                  </Button>
                )}
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
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar usuario?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará al usuario y todos sus datos. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirmEmail">Escribe el email del usuario para confirmar: {selectedUser?.email}</Label>
              <Input
                id="confirmEmail"
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={selectedUser?.email}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setConfirmEmail(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedUser && handleDeleteUser(selectedUser.id)}
              disabled={confirmEmail !== selectedUser?.email}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="w-[95vw] max-w-md">
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
