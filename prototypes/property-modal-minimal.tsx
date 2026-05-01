"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PropertyForm } from "@/components/properties/property-form";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PropertyModalMinimalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>;
  usedColors?: string[];
}

export function PropertyModalMinimal({
  open,
  onOpenChange,
  onSubmit,
  usedColors = [],
}: PropertyModalMinimalProps) {
  const handleSubmit = async (data: any) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Nueva Propiedad</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Complete la información para crear una nueva propiedad
              </p>
            </div>
          </div>
        </DialogHeader>
        <PropertyForm
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          usedColors={usedColors}
        />
      </DialogContent>
    </Dialog>
  );
}

export function PropertyModalMinimalTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <Button onClick={onClick}>
      <Plus className="h-4 w-4 mr-2" />
      Nueva Propiedad
    </Button>
  );
}