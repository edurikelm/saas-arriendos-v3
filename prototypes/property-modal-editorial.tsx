"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PropertyForm } from "@/components/properties/property-form";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PropertyModalEditorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>;
  usedColors?: string[];
}

export function PropertyModalEditorial({
  open,
  onOpenChange,
  onSubmit,
  usedColors = [],
}: PropertyModalEditorialProps) {
  const handleSubmit = async (data: any) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 bg-background">
        <div className="relative bg-muted/30">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/50 to-primary/10" />

          <div className="relative px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-sm bg-foreground flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-background" />
                </div>
                <div>
                  <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                    Propiedades
                  </div>
                  <DialogTitle className="text-3xl font-serif font-bold tracking-tight">
                    Nueva Propiedad
                  </DialogTitle>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono text-muted-foreground">Paso 1 de 4</div>
                <div className="w-20 h-1 bg-border mt-2">
                  <div className="w-1/4 h-full bg-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          <PropertyForm
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            usedColors={usedColors}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PropertyModalEditorialTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      className="border-2 border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors duration-200"
    >
      <Plus className="h-4 w-4 mr-2" />
      Nueva Propiedad
    </Button>
  );
}