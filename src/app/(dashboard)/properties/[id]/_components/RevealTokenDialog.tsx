"use client";

import { useState, useTransition } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FeedMode = "create" | "regenerate";

interface RevealTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  channel: string;
  mode: FeedMode;
  onSuccess?: () => void;
}

interface RevealTokenResult {
  success: boolean;
  rawToken?: string;
  error?: string;
}

async function fetchToken(
  propertyId: string,
  channel: string,
  mode: FeedMode
): Promise<RevealTokenResult> {
  const { createPropertyExportFeed, regeneratePropertyExportFeed } = await import(
    "@/lib/actions/property-export-feeds"
  );

  if (mode === "create") {
    return createPropertyExportFeed({ propertyId, channel: channel as "AIRBNB" | "BOOKING_COM" | "VRBO" | "OTHER" }) as Promise<RevealTokenResult>;
  } else {
    return regeneratePropertyExportFeed({ propertyId, channel: channel as "AIRBNB" | "BOOKING_COM" | "VRBO" | "OTHER" }) as Promise<RevealTokenResult>;
  }
}

export function RevealTokenDialog({
  open,
  onOpenChange,
  propertyId,
  channel,
  mode,
  onSuccess,
}: RevealTokenDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const channelLabels: Record<string, string> = {
    AIRBNB: "Airbnb",
    BOOKING_COM: "Booking.com",
    VRBO: "VRBO",
    OTHER: "Otro",
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setToken(null);
      setUrl(null);
      setConfirmed(false);
      setCopied(false);
    }
    onOpenChange(newOpen);
  };

  const handleReveal = () => {
    startTransition(async () => {
      const result = await fetchToken(propertyId, channel, mode);

      if (result.success && result.rawToken) {
        setToken(result.rawToken);
        const appUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
        setUrl(`${appUrl}/api/ical/export?token=${result.rawToken}&channel=${channel}`);
      } else {
        toast.error(result.error || "Error al generar el feed");
        handleOpenChange(false);
      }
    });
  };

  const handleCopy = async () => {
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("URL copiada al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Error al copiar");
    }
  };

  const handleDone = () => {
    handleOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Feed creado" : "Feed regenerado"}
          </DialogTitle>
          <DialogDescription>
            {channelLabels[channel] ?? channel} — Copia esta URL antes de cerrar
          </DialogDescription>
        </DialogHeader>

        {!token ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="text-sm text-warning-foreground">
                  <p className="font-medium">Esta URL solo se muestra una vez</p>
                  <p className="mt-1">
                    No podrás ver la URL completa después de cerrar este diálogo.
                    Guárdala en un lugar seguro.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="confirm-token"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <label
                htmlFor="confirm-token"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Entiendo que la URL solo se muestra una vez
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <p className="text-sm text-warning-foreground">
                  Guarda esta URL en un lugar seguro. La necesitarás para configurar
                  el calendario en {channelLabels[channel]}.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">URL del feed iCal</label>
              <div className="flex gap-2">
                <Input
                  value={url ?? ""}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  disabled={copied}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!token ? (
            <Button
              onClick={handleReveal}
              disabled={!confirmed || isPending}
            >
              {isPending ? "Generando..." : "Mostrar URL"}
            </Button>
          ) : (
            <Button onClick={handleDone}>Cerrar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
