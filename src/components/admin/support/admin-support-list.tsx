"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { LifeBuoy, MessageSquare, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import type { AdminSupportTicketRow } from "@/lib/actions/admin-support";
import type { StatusFilter } from "@/lib/support/types";

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
  { value: "all", label: "Todas" },
  { value: "HIGH", label: "Alta" },
  { value: "MEDIUM", label: "Media" },
  { value: "LOW", label: "Baja" },
];

const categoryOptions = [
  { value: "all", label: "Todas" },
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
  const currentPriority = searchParams.get("priority") || "all";
  const currentCategory = searchParams.get("category") || "all";
  const currentOwnerId = searchParams.get("ownerId") || "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/admin/support?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Status filter pills (canónico rounded-full pattern per support-list.tsx) */}
      <div className="flex flex-wrap items-center gap-1 rounded-full border border-border bg-muted p-1">
        {statusFilterOptions.map((opt) => {
          const isActive = currentFilter === opt.value || (!currentFilter && opt.value === "ALL");
          return (
            <button
              key={opt.value}
              onClick={() => updateParam("status", opt.value === "ALL" ? "" : opt.value)}
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Secondary filters: priority/category/ownerId */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="filter-priority">Prioridad:</label>
          <Select
            value={currentPriority}
            onValueChange={(value) => updateParam("priority", value ?? "all")}
          >
            <SelectTrigger id="filter-priority" className="h-8 w-[140px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="filter-category">Categoría:</label>
          <Select
            value={currentCategory}
            onValueChange={(value) => updateParam("category", value ?? "all")}
          >
            <SelectTrigger id="filter-category" className="h-8 w-[160px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="filter-owner">Owner Email:</label>
          <Input
            id="filter-owner"
            type="text"
            value={currentOwnerId}
            onChange={(e) => updateParam("ownerId", e.target.value)}
            placeholder="ID del owner..."
            className="h-8 w-40"
          />
        </div>

        {(currentPriority !== "all" || currentCategory !== "all" || currentOwnerId) && (
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

      {/* Results count (when filtered) */}
      {(currentFilter || currentPriority !== "all" || currentCategory !== "all" || currentOwnerId) && (
        <p className="text-xs text-muted-foreground">
          {tickets.length} de {total} tickets
        </p>
      )}

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-16 text-center">
          <LifeBuoy className="mb-2 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">No hay tickets de soporte</p>
          <p className="text-xs text-muted-foreground">
            {currentFilter ? "No hay tickets con ese filtro" : "Aún no se han creado tickets"}
          </p>
        </div>
      ) : (
        <DataTable
          headers={[
            "Asunto",
            "Propietario",
            "Estado",
            "Prioridad",
            "Categoría",
            "Mensajes",
            "Actividad",
          ]}
          caption="Lista de tickets de soporte"
        >
          {tickets.map((ticket) => (
            <tr
              key={ticket.id}
              className={cn(
                "border-b last:border-0 hover:bg-muted/30 transition-colors",
                ticket.hasUnread && "bg-primary/5"
              )}
            >
              <td className="px-4 py-3 font-medium">
                <Link
                  href={`/admin/support/${ticket.id}`}
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  {ticket.hasUnread && (
                    <span className="size-2 shrink-0 rounded-full bg-destructive" />
                  )}
                  <span className={cn(ticket.hasUnread && "font-semibold")}>{ticket.subject}</span>
                </Link>
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
        </DataTable>
      )}
    </div>
  );
}
