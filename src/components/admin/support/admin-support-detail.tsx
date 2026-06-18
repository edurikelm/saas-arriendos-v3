"use client";

import { useState, useOptimistic, startTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  LifeBuoy,
  Send,
  CheckCircle2,
  XCircle,
  User,
  Mail,
  CalendarDays,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  ArrowUpDown,
  Tags,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { SupportImageUpload } from "@/components/support/support-image-upload";
import type { AdminTicketDetail, AdminSupportMessage } from "@/lib/actions/admin-support";
import type { AttachmentInput } from "@/lib/validations/support";

interface AdminSupportDetailProps {
  data: AdminTicketDetail;
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminSupportDetail({ data }: AdminSupportDetailProps) {
  const router = useRouter();
  const { ticket, messages, owner } = data;
  const isClosed = ticket.status === "CLOSED";
  const isResolved = ticket.status === "RESOLVED";

  const [optimisticMessages, addOptimisticMessage] = useOptimistic<
    AdminSupportMessage[],
    AdminSupportMessage
  >(messages, (state, newMessage) => [...state, newMessage]);

  const [responseText, setResponseText] = useState("");
  const [images, setImages] = useState<AttachmentInput[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState(ticket.priority);
  const [selectedCategory, setSelectedCategory] = useState(ticket.category);
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [updatingCategory, setUpdatingCategory] = useState(false);

  async function handleUpdatePriority() {
    if (updatingPriority || selectedPriority === ticket.priority) return;
    setUpdatingPriority(true);
    const { updateSupportTicketPriority } = await import("@/lib/actions/admin-support");
    const result = await updateSupportTicketPriority(ticket.id, selectedPriority);
    setUpdatingPriority(false);
    if (result.success) {
      router.refresh();
    }
  }

  async function handleUpdateCategory() {
    if (updatingCategory || selectedCategory === ticket.category) return;
    setUpdatingCategory(true);
    const { updateSupportTicketCategory } = await import("@/lib/actions/admin-support");
    const result = await updateSupportTicketCategory(ticket.id, selectedCategory);
    setUpdatingCategory(false);
    if (result.success) {
      router.refresh();
    }
  }

  async function handleRespond() {
    if (!responseText.trim() || sending) return;

    const content = responseText.trim();
    setSending(true);

    startTransition(() => {
      addOptimisticMessage({
        id: `temp-${Date.now()}`,
        supportTicketId: ticket.id,
        authorId: "admin",
        content,
        createdAt: new Date().toISOString(),
        attachments: images.map((img) => ({
          id: `temp-${Date.now()}-${img.fileName}`,
          url: img.url,
          fileName: img.fileName,
          fileSize: img.fileSize,
          createdAt: new Date().toISOString(),
        })),
        author: { id: "admin", name: "Tú", email: "" },
      });
    });

    const { respondToSupportTicket } = await import("@/lib/actions/admin-support");
    const result = await respondToSupportTicket(ticket.id, content, images.length > 0 ? images : undefined);

    setSending(false);

    if (result.success) {
      setResponseText("");
      setImages([]);
      router.refresh();
    }
  }

  async function handleResolve() {
    if (resolving) return;
    setResolving(true);

    const { resolveSupportTicket } = await import("@/lib/actions/admin-support");
    await resolveSupportTicket(ticket.id);

    setResolving(false);
    router.refresh();
  }

  async function handleClose() {
    if (closing) return;
    setClosing(true);

    const { closeSupportTicket } = await import("@/lib/actions/admin-support");
    await closeSupportTicket(ticket.id);

    setClosing(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/support"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <LifeBuoy className="size-5 text-muted-foreground" />
                    {ticket.subject}
                  </CardTitle>
                  <CardDescription>
                    {categoryLabels[ticket.category] || ticket.category} &middot; Prioridad{" "}
                    {priorityLabels[ticket.priority] || ticket.priority}
                  </CardDescription>
                </div>
                <Badge variant={statusVariants[ticket.status] || "default"} className="shrink-0">
                  {statusLabels[ticket.status] || ticket.status}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="size-4 text-muted-foreground" />
                Conversación ({optimisticMessages.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {optimisticMessages.map((msg, idx) => {
                const isAdmin = msg.author.email !== owner.email;
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
                          {isAdmin ? "Soporte (Tú)" : msg.author.name || msg.author.email}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(msg.createdAt)}
                        </span>
                        {idx === 0 && (
                          <span className="text-xs text-muted-foreground font-medium">· Descripción inicial</span>
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

          {!isClosed && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send className="size-4 text-muted-foreground" />
                  Responder
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await handleRespond();
                  }}
                  className="space-y-3"
                >
                  <Textarea
                    placeholder="Escribe tu respuesta..."
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={4}
                    maxLength={2000}
                  />
                  <SupportImageUpload images={images} onChange={setImages} onUploadingChange={setUploading} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {responseText.length}/2000 caracteres
                    </span>
                    <Button type="submit" disabled={sending || uploading || !responseText.trim()}>
                      <Send className="mr-2 h-4 w-4" />
                      {sending ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {isClosed && (
            <p className="text-center text-sm text-muted-foreground">
              Este ticket está cerrado. No se pueden agregar más respuestas.
            </p>
          )}
          {isResolved && (
            <p className="text-center text-xs text-muted-foreground">
              Ticket resuelto. Puedes agregar más respuestas si es necesario.
            </p>
          )}
        </div>

        <div className="space-y-6">
          {data.affectedEntity && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tags className="size-4 text-muted-foreground" />
                  Entidad Afectada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <Badge variant="secondary" className="mb-2">
                    {data.affectedEntity.type === "RESERVATION" ? "Reserva" : data.affectedEntity.type === "PAYMENT" ? "Pago" : "Propiedad"}
                  </Badge>
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    {data.affectedEntity.id}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="size-4 text-muted-foreground" />
                Propietario
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar size="default" className="size-10 ring-1 ring-border">
                  <AvatarFallback className="bg-gradient-to-br from-primary/15 to-violet-500/15 text-sm font-semibold">
                    {getInitials(owner.name, owner.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">{owner.name || "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground truncate">{owner.email}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{owner.email}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Sparkles className="size-3.5 shrink-0" />
                  <span>{owner.plan || "FREE"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="size-3.5 shrink-0" />
                  <span>Creado: {formatDate(ticket.createdAt)}</span>
                </div>
              </div>

              <Link
                href={`/admin/users/${owner.id}`}
                className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}
              >
                <User className="mr-2 h-4 w-4" />
                Ver perfil
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ArrowUpDown className="size-4 text-muted-foreground" />
                Clasificación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Prioridad</label>
                <div className="flex gap-2">
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUpdatePriority}
                    disabled={updatingPriority || selectedPriority === ticket.priority}
                  >
                    {updatingPriority ? "..." : "Guardar"}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                <div className="flex gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="RESERVATIONS">Reservas</option>
                    <option value="PAYMENTS">Pagos</option>
                    <option value="PROPERTIES">Propiedades</option>
                    <option value="ACCOUNT">Cuenta</option>
                    <option value="OTHER">Otro</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUpdateCategory}
                    disabled={updatingCategory || selectedCategory === ticket.category}
                  >
                    {updatingCategory ? "..." : "Guardar"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!isResolved && !isClosed && (
                <Button
                  variant="default"
                  className="w-full"
                  onClick={handleResolve}
                  disabled={resolving}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {resolving ? "Resolviendo..." : "Marcar como Resuelto"}
                </Button>
              )}
              {!isClosed && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleClose}
                  disabled={closing}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {closing ? "Cerrando..." : "Cerrar Ticket"}
                </Button>
              )}
              {isClosed && (
                <p className="text-xs text-center text-muted-foreground">
                  Solo el propietario puede reabrir este ticket respondiendo
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
