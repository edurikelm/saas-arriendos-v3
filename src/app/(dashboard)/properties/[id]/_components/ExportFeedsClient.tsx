"use client";

import { useState, useTransition } from "react";
import { Calendar, RefreshCw, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { RevealTokenDialog } from "./RevealTokenDialog";
import { revokePropertyExportFeed } from "@/lib/actions/property-export-feeds";

type FeedChannel = "AIRBNB" | "BOOKING_COM" | "VRBO" | "OTHER";

const CHANNELS: { value: FeedChannel; label: string }[] = [
  { value: "AIRBNB", label: "Airbnb" },
  { value: "BOOKING_COM", label: "Booking.com" },
  { value: "VRBO", label: "VRBO" },
  { value: "OTHER", label: "Otro" },
];

type Feed = {
  id: string;
  channel: FeedChannel;
  tokenLastFour: string;
  createdAt: Date;
  lastRotatedAt: Date;
  lastFetchedAt: Date | null;
  urlPreview: string;
};

interface ExportFeedsClientProps {
  propertyId: string;
  channels: { value: FeedChannel; label: string }[];
  feeds: Feed[];
  isPro: boolean;
}

function ChannelBadge({ channel }: { channel: FeedChannel }) {
  return (
    <Badge variant="outline">
      {CHANNELS.find((c) => c.value === channel)?.label ?? channel}
    </Badge>
  );
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Nunca";
  try {
    return `hace ${formatDistanceToNow(date, { addSuffix: true, locale: es })}`;
  } catch {
    return "Nunca";
  }
}

export function ExportFeedsClient({
  propertyId,
  channels,
  feeds,
  isPro,
}: ExportFeedsClientProps) {
  const [revealDialog, setRevealDialog] = useState<{
    open: boolean;
    channel: FeedChannel;
    mode: "create" | "regenerate";
  } | null>(null);
  const [revokingChannel, setRevokingChannel] = useState<FeedChannel | null>(null);
  const [isPending, startTransition] = useTransition();

  const getFeedForChannel = (channel: FeedChannel) =>
    feeds.find((f) => f.channel === channel);

  const handleRevoke = (channel: FeedChannel) => {
    startTransition(async () => {
      const result = await revokePropertyExportFeed({ propertyId, channel });

      if (result.success) {
        toast.success("Feed revocado");
        setRevokingChannel(null);
        // Let the parent handle refresh
        window.location.reload();
      } else {
        toast.error(result.error || "Error al revocar el feed");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Feeds iCal de Exportación</h3>
        {!isPro && (
          <Badge variant="secondary" className="ml-auto">
            Disponible en plan PRO
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Genera URLs de calendario para compartir disponibilidad con canales externos.
        Los bloqueos del mismo canal se excluyen automáticamente (anti-reimport).
      </p>

      <div className="space-y-3">
        {channels.map((c) => {
          const value = c.value;
          const feed = getFeedForChannel(value);

          return (
            <div
              key={value}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-3">
                <ChannelBadge channel={value} />
                <div className="text-sm">
                  {feed ? (
                    <div className="space-y-1">
                      <p className="font-mono text-xs text-muted-foreground">
                        ...{feed.tokenLastFour}
                      </p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>
                          Última rotación: {formatRelativeTime(feed.lastRotatedAt)}
                        </span>
                        <span>
                          Último fetch: {formatRelativeTime(feed.lastFetchedAt)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      Sin feed configurado
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {feed ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isPro}
                      onClick={() =>
                        setRevealDialog({
                          open: true,
                          channel: value,
                          mode: "regenerate",
                        })
                      }
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Regenerar
                    </Button>

                    {revokingChannel === value ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevoke(value)}
                          disabled={isPending}
                        >
                          {isPending ? "Revocando..." : "Confirmar"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRevokingChannel(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!isPro}
                        onClick={() => setRevokingChannel(value)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!isPro}
                    onClick={() =>
                      setRevealDialog({
                        open: true,
                        channel: value,
                        mode: "create",
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Crear feed
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {revealDialog && (
        <RevealTokenDialog
          key={`${revealDialog.channel}-${revealDialog.mode}`}
          open={revealDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setRevealDialog(null);
            }
          }}
          propertyId={propertyId}
          channel={revealDialog.channel}
          mode={revealDialog.mode}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
