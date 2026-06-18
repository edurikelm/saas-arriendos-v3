"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { LifeBuoy, MessageSquare, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminSupportTicketRow, StatusFilter } from "@/lib/actions/admin-support";

interface AdminSupportListProps {
  tickets: AdminSupportTicketRow[];
  total: number;
}

const statusLabels: Record<string, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En Progreso",
  RESOLVED: "Resuelto",
  CLOSED: "Cerrado",
};

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  OPEN: "default",
  IN_PROGRESS: "secondary",
  RESOLVED: "outline",
  CLOSED: "destructive",
};

const priorityLabels: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
};

const categoryLabels: Record<string, string> = {
  RESERVATIONS: "Reservas",
  PAYMENTS: "Pagos",
  PROPERTIES: "Propiedades",
  ACCOUNT: "Cuenta",
  OTHER: "Otro",
};

const statusFilterOptions: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "OPEN", label: "Abiertos" },
  { value: "IN_PROGRESS", label: "En Progreso" },
  { value: "RESOLVED", label: "Resueltos" },
  { value: "CLOSED", label: "Cerrados" },
];

const priorityOptions = [
  { value: "", label: "Todas" },
  { value: "HIGH", label: "Alta" },
  { value: "MEDIUM", label: "Media" },
  { value: "LOW", label: "Baja" },
];

const categoryOptions = [
  { value: "", label: "Todas" },
  { value: "RESERVATIONS", label: "Reservas" },
  { value: "PAYMENTS", label: "Pagos" },
  { value: "PROPERTIES", label: "Propiedades" },
  { value: "ACCOUNT", label: "Cuenta" },
  { value: "OTHER", label: "Otro" },
];

export function AdminSupportList({ tickets, total }: AdminSupportListProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentFilter = (searchParams.get("status") as StatusFilter) || undefined;
  const currentPriority = searchParams.get("priority") || "";
  const currentCategory = searchParams.get("category") || "";
  const currentOwnerId = searchParams.get("ownerId") || "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/admin/support?${params.toString()}`);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="size-5 text-muted-foreground" />
              Soporte
            </CardTitle>
            <CardDescription>
              Bandeja de entrada de tickets de soporte ({total} tickets)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Estado:</span>
          {statusFilterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateParam("status", opt.value === "ALL" ? "" : opt.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                (currentFilter === opt.value || (!currentFilter && opt.value === "ALL"))
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Prioridad:</label>
            <select
              value={currentPriority}
              onChange={(e) => updateParam("priority", e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              {priorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Categoría:</label>
            <select
              value={currentCategory}
              onChange={(e) => updateParam("category", e.target.value)}
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Owner Email:</label>
            <input
              type="text"
              value={currentOwnerId}
              onChange={(e) => updateParam("ownerId", e.target.value)}
              placeholder="ID del owner..."
              className="rounded-md border bg-background px-3 py-1.5 text-sm w-40"
            />
          </div>
          {(currentPriority || currentCategory || currentOwnerId) && (
            <button
              onClick={() => {
                const params = new URLSearchParams();
                if (currentFilter) params.set("status", currentFilter);
                router.push(`/admin/support?${params.toString()}`);
              }}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-16 text-center">
            <LifeBuoy className="mb-2 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">No hay tickets de soporte</p>
            <p className="text-xs text-muted-foreground">
              {currentFilter ? "No hay tickets con ese filtro" : "Aún no se han creado tickets"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Asunto</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Propietario</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Prioridad</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Categoría</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Mensajes</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Actividad</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className={cn(
                      "border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors",
                      ticket.hasUnread && "bg-primary/5"
                    )}
                    onClick={() => router.push(`/admin/support/${ticket.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        {ticket.hasUnread && (
                          <span className="size-2 shrink-0 rounded-full bg-destructive" />
                        )}
                        <span className={cn(ticket.hasUnread && "font-semibold")}>{ticket.subject}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="size-3.5 shrink-0" />
                        <span className="truncate max-w-[150px]">{ticket.ownerEmail}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariants[ticket.status] || "default"}>
                        {statusLabels[ticket.status] || ticket.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {priorityLabels[ticket.priority] || ticket.priority}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {categoryLabels[ticket.category] || ticket.category}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MessageSquare className="size-3.5" />
                        <span>{ticket.messageCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground tabular-nums">
                      {new Date(ticket.lastActivityAt).toLocaleDateString("es-CL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
