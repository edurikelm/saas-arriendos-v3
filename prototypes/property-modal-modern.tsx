"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PropertyForm } from "@/components/properties/property-form";
import { Plus, Building2, Home, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PropertyModalModernProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>;
  usedColors?: string[];
}

export function PropertyModalModern({
  open,
  onOpenChange,
  onSubmit,
  usedColors = [],
}: PropertyModalModernProps) {
  const handleSubmit = async (data: any) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative p-6 pb-0">
            <DialogHeader className="space-y-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center shadow-lg">
                    <Building2 className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold tracking-tight">
                      Nueva Propiedad
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Complete los detalles para crear una nueva propiedad
                    </p>
                  </div>
                </div>
              </div>
            </DialogHeader>
          </div>
        </div>

        <div className="px-6 pb-6 max-h-[calc(90vh-180px)] overflow-y-auto">
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

export function PropertyModalModernTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <Button onClick={onClick} className="relative overflow-hidden group">
      <span className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <Plus className="h-4 w-4 mr-2 relative z-10" />
      <span className="relative z-10">Nueva Propiedad</span>
    </Button>
  );
}