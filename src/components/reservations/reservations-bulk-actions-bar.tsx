"use client";

import { X, Ban, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReservationsBulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkCancel: () => void;
  onGenerateLinks: () => void;
}

export function ReservationsBulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkCancel,
  onGenerateLinks,
}: ReservationsBulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between gap-3 px-4 py-3 mx-auto max-w-screen-xl">
        <p className="text-sm font-medium">
          <span className="text-primary">{selectedCount}</span>{" "}
          {selectedCount === 1 ? "reserva seleccionada" : "reservas seleccionadas"}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onGenerateLinks}>
            <Link2 className="mr-1.5 h-4 w-4" />
            Generar links MP
          </Button>
          <Button variant="destructive" size="sm" onClick={onBulkCancel}>
            <Ban className="mr-1.5 h-4 w-4" />
            Cancelar seleccionadas
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            <X className="mr-1.5 h-4 w-4" />
            Limpiar
          </Button>
        </div>
      </div>
    </div>
  );
}
