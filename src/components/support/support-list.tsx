"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, Plus, LifeBuoy, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { cn } from "@/lib/utils";
import type { PaginatedResponse } from "@/types/pagination";
import type { SupportTicketRow, SupportTicketsKpis } from "@/lib/actions/support";

interface SupportListProps {
  initialData: PaginatedResponse<SupportTicketRow>;
  currentStatus?: string;
  kpis?: SupportTicketsKpis;
}

const statusLabels: Record<string, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En Progreso",
  RESOLVED: "Resuelto",
  CLOSED: "Cerrado",
};

const statusBadgeVariants: Record<string, "info" | "warning" | "success" | "secondary"> = {
  OPEN: "info",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "secondary",
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

const filterOptions = [
  { value: "ALL", label: "Todos" },
  { value: "OPEN", label: "Abierto" },
  { value: "IN_PROGRESS", label: "En Progreso" },
  { value: "RESOLVED", label: "Resuelto" },
  { value: "CLOSED", label: "Cerrado" },
];

function formatLastActivity(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return `Hace ${mins} min`;
  }
  if (diffHours < 24) {
    const hours = Math.floor(diffHours);
    return `Hace ${hours}h`;
  }
  if (diffHours < 48) {
    return "Ayer";
  }
  return date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SupportList({ initialData, currentStatus, kpis }: SupportListProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeFilter = currentStatus || "ALL";

  function setFilter(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status && status !== "ALL") {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    const query = params.toString();
    router.push(query ? `/support?${query}` : "/support");
  }

  const openCount = kpis?.openCount ?? 0;
  const resolvedCount = kpis?.resolvedCount ?? 0;
  const avgHours = kpis?.avgResponseHours;
  const avgDisplay = avgHours !== null && avgHours !== undefined
    ? `${avgHours.toFixed(1)}h`
    : "—";

  const headers = [
    "ID Ticket",
    "Asunto",
    "Estado",
    "Prioridad",
    "Última actualización",
    { label: "Acciones", align: "right" as const },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Ayuda y Soporte</h1>
        <p className="text-xs text-muted-foreground">
          Gestiona tus tickets de soporte y consulta la documentacion tecnica
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Tickets abiertos"
          value={openCount}
          icon={LifeBuoy}
          tone="warning"
          indicator={{ text: "Requieren atención", variant: "neutral" }}
        />
        <KpiCard
          label="Resueltos"
          value={resolvedCount}
          icon={CheckCircle2}
          tone="success"
          indicator={{ text: "Historial acumulado", variant: "neutral" }}
        />
        <KpiCard
          label="Tiempo medio de respuesta"
          value={avgDisplay}
          icon={Clock}
          tone="info"
          indicator={{ text: "Primera respuesta de admin", variant: "neutral" }}
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
        <h2 className="text-sm font-bold text-foreground">Mis Tickets de Soporte</h2>
        <div className="flex items-center gap-1 rounded-full border border-border bg-muted p-1">
          {filterOptions.map((opt) => {
            const isActive = activeFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
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
        <Link
          href="/support/new"
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Ticket
        </Link>
      </div>

      {/* DataTable */}
      <DataTable
        headers={headers}
        caption="Lista de tickets de soporte"
        emptyState={
          <p>No tienes tickets de soporte. Crea uno nuevo para recibir ayuda.</p>
        }
      >
        {initialData.data.map((ticket) => (
          <tr
            key={ticket.id}
            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
          >
            <td className="px-6 py-5 text-xs font-bold text-foreground">
              #{ticket.id.slice(0, 8).toUpperCase()}
            </td>
            <td className="px-6 py-5">
              <div className="flex items-start gap-2">
                {ticket.hasUnread && (
                  <span className="bg-destructive size-2 rounded-full mt-1.5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-medium text-foreground">{ticket.subject}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {categoryLabels[ticket.category] || ticket.category}
                  </p>
                </div>
              </div>
            </td>
            <td className="px-6 py-5">
              <Badge variant={statusBadgeVariants[ticket.status] || "secondary"}>
                {statusLabels[ticket.status] || ticket.status}
              </Badge>
            </td>
            <td className="px-6 py-5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    ticket.priority === "HIGH" && "bg-destructive",
                    ticket.priority === "MEDIUM" && "bg-muted-foreground",
                    ticket.priority === "LOW" && "bg-muted-foreground opacity-60"
                  )}
                />
                {priorityLabels[ticket.priority] || ticket.priority}
              </span>
            </td>
            <td className="px-6 py-5 text-xs text-muted-foreground">
              {formatLastActivity(ticket.lastActivityAt)}
            </td>
            <td className="px-6 py-5 text-right">
              <Link
                href={`/support/${ticket.id}`}
                className="inline-flex p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Ver ticket"
              >
                <Eye className="size-4" />
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
