"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, RefreshCw, Trash2, Plus, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createExternalCalendarInputSchema,
  type CreateExternalCalendarInput,
} from "@/lib/validations/external-calendar";
import { channelColors, type Channel } from "@/lib/calendar/channel-colors";
import { cn } from "@/lib/utils";
import {
  createExternalCalendar,
  deleteExternalCalendar,
  syncExternalCalendar,
} from "@/lib/actions/external-calendars";
import {
  getSyncStatus,
  formatRelativeTime,
  type ImportCalendar,
  type SyncStatus,
} from "./import-calendars-utils";

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "AIRBNB", label: "Airbnb" },
  { value: "BOOKING_COM", label: "Booking.com" },
  { value: "VRBO", label: "VRBO" },
  { value: "OTHER", label: "Otro" },
];

interface ImportCalendarsClientProps {
  propertyId: string;
  calendars: ImportCalendar[];
}

function ChannelDot({ channel }: { channel: Channel }) {
  const { dotClass, labelClass } = channelColors[channel];
  const label = CHANNELS.find((c) => c.value === channel)?.label ?? channel;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", dotClass)} />
      <span className={cn("text-xs font-medium", labelClass)}>{label}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: SyncStatus }) {
  if (status === "ok") {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="size-3" /> Sincronizado
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="size-3" /> Con errores
      </Badge>
    );
  }
  if (status === "stale") {
    return (
      <Badge variant="warning" className="gap-1">
        <Clock className="size-3" /> Desactualizado
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <AlertCircle className="size-3" /> Nunca sincronizado
    </Badge>
  );
}

function AddCalendarDialog({ propertyId, onCreated }: { propertyId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateExternalCalendarInput>({
    resolver: zodResolver(createExternalCalendarInputSchema),
    defaultValues: { propertyId, channel: "AIRBNB", name: "", feedUrl: "" },
  });

  const channel = watch("channel");

  const onSubmit = (data: CreateExternalCalendarInput) => {
    startTransition(async () => {
      const result = await createExternalCalendar(data);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Calendario agregado. La primera sincronización puede tardar unos minutos.");
      reset({ propertyId, channel: "AIRBNB", name: "", feedUrl: "" });
      setOpen(false);
      onCreated();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">
        <Plus className="size-4" />
        Agregar calendario
      </Button>} />
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar calendario externo</DialogTitle>
          <DialogDescription>
            Pega la URL del feed iCal de Airbnb, Booking.com, VRBO u otro canal.
            Lo sincronizaremos cada día automáticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              placeholder="Ej: Airbnb — Casa Lago"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel">Canal</Label>
            <Select
              value={channel}
              onValueChange={(v) => setValue("channel", v as Channel)}
            >
              <SelectTrigger id="channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.channel && (
              <p className="text-sm text-destructive">{errors.channel.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedUrl">URL del feed iCal</Label>
            <Input
              id="feedUrl"
              type="url"
              placeholder="https://..."
              {...register("feedUrl")}
            />
            {errors.feedUrl && (
              <p className="text-sm text-destructive">{errors.feedUrl.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Debe ser una URL HTTPS pública.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Agregando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CalendarRow({
  calendar,
  onChanged,
}: {
  calendar: ImportCalendar;
  onChanged: () => void;
}) {
  const [isSyncing, startSync] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const status = getSyncStatus(calendar);

  const handleSync = () => {
    startSync(async () => {
      const result = await syncExternalCalendar({ id: calendar.id });
      if ("error" in result) {
        toast.error(`Error: ${result.error}`);
      } else {
        toast.success(`Sincronizado. ${result.count} bloqueos activos.`);
      }
      onChanged();
    });
  };

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteExternalCalendar(calendar.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Calendario eliminado");
      onChanged();
    });
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-foreground truncate">{calendar.name}</p>
            <ChannelDot channel={calendar.channel} />
            <StatusBadge status={status} />
            {!calendar.isActive && (
              <Badge variant="secondary">Inactivo</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {calendar.feedUrl}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing || !calendar.isActive}
          >
            <RefreshCw className={cn("size-4", isSyncing && "animate-spin")} />
            Sincronizar
          </Button>

          {showDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Eliminando..." : "Confirmar"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Eliminar ${calendar.name}`}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          Última sync: <span className="text-foreground font-medium">{formatRelativeTime(calendar.lastSyncedAt)}</span>
        </span>
        {calendar.lastSyncCount !== null && (
          <span>
            Bloqueos activos: <span className="text-foreground font-medium">{calendar.lastSyncCount}</span>
          </span>
        )}
      </div>

      {calendar.lastSyncError && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
          <span className="break-all">{calendar.lastSyncError}</span>
        </div>
      )}
    </div>
  );
}

export function ImportCalendarsClient({ propertyId, calendars }: ImportCalendarsClientProps) {
  // Reload page after a successful mutation so the section re-fetches from DB.
  const handleChanged = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Download className="size-5 text-muted-foreground" />
            <CardTitle>Calendarios externos importados</CardTitle>
          </div>
          <AddCalendarDialog propertyId={propertyId} onCreated={handleChanged} />
        </div>
        <CardDescription>
          Conecta feeds iCal de Airbnb, Booking.com, VRBO u otros canales. Los eventos importados
          bloquean disponibilidad automáticamente sin generar reservas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {calendars.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no tienes calendarios externos conectados. Haz clic en{" "}
              <span className="font-medium text-foreground">&quot;Agregar calendario&quot;</span>{" "}
              para empezar.
            </p>
          </div>
        ) : (
          calendars.map((c) => (
            <CalendarRow key={c.id} calendar={c} onChanged={handleChanged} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
