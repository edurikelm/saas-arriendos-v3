"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PropertyForm } from "@/components/properties/property-form";
import { Plus, Building2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PropertyModalLuxuryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>;
  usedColors?: string[];
}

export function PropertyModalLuxury({
  open,
  onOpenChange,
  onSubmit,
  usedColors = [],
}: PropertyModalLuxuryProps) {
  const handleSubmit = async (data: any) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 bg-gradient-to-b from-card to-card/80">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          <div className="relative px-8 pt-8 pb-4">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <DialogTitle className="text-2xl font-serif font-semibold tracking-wide">
                  Nueva Propiedad
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1 font-light">
                  Cree una nueva propiedad para su portafolio
                </p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

        <div className="px-8 pb-8 pt-4 max-h-[calc(90vh-160px)] overflow-y-auto">
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

export function PropertyModalLuxuryTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      onClick={onClick}
      className="font-serif tracking-wide shadow-sm hover:shadow-md transition-shadow duration-300"
    >
      <Plus className="h-4 w-4 mr-2" />
      Nueva Propiedad
    </Button>
  );
}