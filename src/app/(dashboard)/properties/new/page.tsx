"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PropertyForm } from "@/components/properties/property-form";
import type { PropertyInput } from "@/lib/validations/property";
import { useRouter } from "next/navigation";

interface NewPropertyPageProps {
  open?: boolean;
  onClose?: () => void;
}

export default function NewPropertyPage({ open = true, onClose }: NewPropertyPageProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(open);

  const handleCreate = async (data: PropertyInput) => {
    const res = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (result.error) {
      if (result.upgrade) {
        alert(result.error);
        return;
      }
      throw new Error(result.error);
    }

    setIsOpen(false);
    if (onClose) onClose();
    router.push("/properties");
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Nueva Propiedad</h1>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Nueva Propiedad</DialogTitle>
          </DialogHeader>
          <PropertyForm
            onSubmit={handleCreate}
            onCancel={() => {
              setIsOpen(false);
              if (onClose) onClose();
              router.back();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}