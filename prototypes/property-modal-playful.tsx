"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PropertyForm } from "@/components/properties/property-form";
import { Plus, Building2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PropertyModalPlayfulProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>;
  usedColors?: string[];
}

export function PropertyModalPlayful({
  open,
  onOpenChange,
  onSubmit,
  usedColors = [],
}: PropertyModalPlayfulProps) {
  const handleSubmit = async (data: any) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 rounded-2xl">
        <div className="relative overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10" />

          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-primary/20 to-transparent" />

          <div className="relative p-6 pb-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-background shadow-lg border-4 border-primary/20 flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-2xl font-black tracking-tight">
                      Nueva
                    </DialogTitle>
                    <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      Propiedad
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Llenar los datos para continuar
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < 2 ? "text-amber-400 fill-amber-400" : "text-border"}`}
                  />
                ))}
              </div>
            </div>
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

export function PropertyModalPlayfulTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      onClick={onClick}
      className="rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
    >
      <Plus className="h-4 w-4 mr-2" />
      Nueva Propiedad
    </Button>
  );
}