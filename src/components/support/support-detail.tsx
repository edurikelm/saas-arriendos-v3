import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SupportMessageForm } from "./support-message-form";
import { cn } from "@/lib/utils";
import { ShieldCheck, MessageSquare } from "lucide-react";
import type { SupportTicketDetail } from "@/lib/actions/support";

interface SupportDetailProps {
  ticket: SupportTicketDetail;
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

const entityTypeLabels: Record<string, string> = {
  RESERVATION: "Reserva",
  PAYMENT: "Pago",
  PROPERTY: "Propiedad",
};

function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SupportDetail({ ticket }: SupportDetailProps) {
  const canAddMessage = ticket.status !== "CLOSED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Badge variant={statusVariants[ticket.status] || "default"}>
          {statusLabels[ticket.status] || ticket.status}
        </Badge>
        <span>
          <span className="text-muted-foreground">Prioridad: </span>
          <Badge variant="outline">{priorityLabels[ticket.priority] || ticket.priority}</Badge>
        </span>
        <span>
          <span className="text-muted-foreground">Categoría: </span>
          <Badge variant="outline">{categoryLabels[ticket.category] || ticket.category}</Badge>
        </span>
        {ticket.affectedEntity && (
          <span>
            <span className="text-muted-foreground">Entidad: </span>
            <Badge variant="secondary">
              {entityTypeLabels[ticket.affectedEntity.type]} #{ticket.affectedEntity.id.slice(0, 8)}
            </Badge>
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          Última actividad: {formatDate(ticket.lastActivityAt)}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="size-4 text-muted-foreground" />
            Conversación ({ticket.messages.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.messages.map((msg, idx) => {
            const isAdmin = msg.authorId !== ticket.userId;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 rounded-lg border p-4",
                  isAdmin ? "bg-primary/5 border-primary/10" : "bg-muted/20"
                )}
              >
                <Avatar size="sm" className="size-8 shrink-0 ring-1 ring-border">
                  <AvatarFallback
                    className={cn(
                      "text-xs",
                      isAdmin
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isAdmin ? (
                      <ShieldCheck className="size-4" />
                    ) : (
                      getInitials(msg.author.name, msg.author.email).slice(0, 2)
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">
                      {isAdmin ? "Soporte" : msg.author.name || msg.author.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(msg.createdAt)}
                    </span>
                    {idx === 0 && (
                      <span className="text-xs text-muted-foreground font-medium">
                        · Descripción inicial
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.attachments.map((att) => (
                        <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer">
                          <Image
                            src={att.url}
                            alt={att.fileName}
                            width={120}
                            height={80}
                            className="rounded-md border object-cover h-20 w-auto"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {!canAddMessage && (
        <p className="text-center text-sm text-muted-foreground">
          Este ticket está cerrado. No se pueden agregar más respuestas.
        </p>
      )}

      <SupportMessageForm
        ticketId={ticket.id}
        canAddMessage={canAddMessage}
        canClose={ticket.status !== "CLOSED"}
      />
    </div>
  );
}
