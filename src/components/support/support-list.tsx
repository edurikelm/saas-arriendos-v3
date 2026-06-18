"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PaginatedResponse } from "@/types/pagination";
import type { SupportTicketRow } from "@/lib/actions/support";

interface SupportListProps {
  initialData: PaginatedResponse<SupportTicketRow>;
  currentStatus?: string;
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

const filterOptions = [
  { value: "ALL", label: "Todos" },
  { value: "OPEN", label: "Abiertos" },
  { value: "IN_PROGRESS", label: "En Progreso" },
  { value: "RESOLVED", label: "Resueltos" },
  { value: "CLOSED", label: "Cerrados" },
];

export function SupportList({ initialData, currentStatus }: SupportListProps) {
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Soporte</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tus tickets de soporte ({initialData.total})
            </p>
          </div>
          <Link
            href="/support/new"
            className={buttonVariants({ variant: "default" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Ticket
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrar:</span>
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeFilter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {initialData.total === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No tienes tickets de soporte. Crea uno nuevo para recibir ayuda.
          </p>
        ) : (
          <div className="space-y-3">
            {initialData.data.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/support/${ticket.id}`}
                className="block rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium flex items-center gap-2">
                    {ticket.hasUnread && (
                      <span className="size-2 rounded-full bg-destructive" />
                    )}
                    {ticket.subject}
                  </h3>
                  <Badge variant={statusVariants[ticket.status] || "default"}>
                    {statusLabels[ticket.status] || ticket.status}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{categoryLabels[ticket.category] || ticket.category}</span>
                  <span>·</span>
                  <span>Prioridad: {priorityLabels[ticket.priority] || ticket.priority}</span>
                  <span>·</span>
                  <span>
                    {new Date(ticket.lastActivityAt).toLocaleDateString("es-CL", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
