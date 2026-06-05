"use client";

import { useEffect, useState } from "react";
import { History, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PlanChangedDetails {
  before?: string;
  after?: string;
}

interface OwnerCreatedDetails {
  email?: string;
  name?: string;
  plan?: string;
}

interface ActionLogDetails {
  before?: string;
  after?: string;
  email?: string;
  name?: string;
  plan?: string;
}

interface ActionLogEntry {
  id: string;
  adminId: string;
  targetId: string;
  action: string;
  details: string | null;
  createdAt: string;
  admin: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface ActionHistoryProps {
  ownerId: string;
}

const actionLabels: Record<string, string> = {
  PLAN_CHANGED: "Cambio de Plan",
  OWNER_CREATED: "Propietario Creado",
  OWNER_DELETED: "Propietario Eliminado",
  UPDATED: "Actualizado",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseDetails(details: string | null): ActionLogDetails | null {
  if (!details) return null;
  try {
    return JSON.parse(details) as ActionLogDetails;
  } catch {
    return null;
  }
}

export function ActionHistory({ ownerId }: ActionHistoryProps) {
  const [logs, setLogs] = useState<ActionLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch(`/api/admin/action-logs?targetId=${ownerId}`);
        if (!res.ok) throw new Error("Error al cargar historial");
        const data = await res.json();
        setLogs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setIsLoading(false);
      }
    }
    fetchLogs();
  }, [ownerId]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Acciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Acciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-center py-8">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de Acciones
        </CardTitle>
        <CardDescription>
          Registro de acciones realizadas por administradores
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No hay acciones registradas
          </p>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => {
              const details = parseDetails(log.details);
              return (
                <div
                  key={log.id}
                  className="flex items-start justify-between p-4 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary">
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>{log.admin.name || log.admin.email}</span>
                      <span>·</span>
                      <span>{formatDate(log.createdAt)}</span>
                    </div>
                    {details && (
                      <div className="mt-2 text-sm">
                        {log.action === "PLAN_CHANGED" && details.before && details.after && (
                          <span className="text-muted-foreground">
                            Plan: <span className="line-through text-muted-foreground/60">{String(details.before)}</span>
                            {" → "}
                            <span className="font-medium">{String(details.after)}</span>
                          </span>
                        )}
                        {log.action === "OWNER_CREATED" && details.plan && (
                          <span className="text-muted-foreground">
                            Plan inicial: <span className="font-medium">{String(details.plan)}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
