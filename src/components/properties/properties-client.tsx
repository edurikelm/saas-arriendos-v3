"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PropertyFormSections as PropertyForm } from "@/components/properties/property-form-sections";
import { PropertyCardGrid } from "@/components/properties/property-card";
import { toast } from "sonner";
import { createProperty, updateProperty, deleteProperty } from "@/lib/actions/properties";
import type { PropertyInput } from "@/lib/validations/property";

interface Property {
  id: string;
  name: string;
  type: "HOUSE" | "APARTMENT" | "CABIN" | "HOSTEL" | "HOTEL" | "OFFICE" | "COMMERCIAL";
  unitsAvailable: number;
  dailyPrice: string;
  monthlyPrice: string | null;
  mainImage: string | null;
  color: string;
  createdAt: string;
}

interface PropertiesClientProps {
  initialProperties: Property[];
  usedColors: string[];
}

const PROPERTY_TYPES = [
  { value: "HOUSE", label: "Casa" },
  { value: "APARTMENT", label: "Departamento" },
  { value: "CABIN", label: "Cabaña" },
  { value: "HOSTEL", label: "Hostel" },
  { value: "HOTEL", label: "Hotel" },
  { value: "OFFICE", label: "Oficina" },
  { value: "COMMERCIAL", label: "Comercial" },
];

export function PropertiesClient({ initialProperties, usedColors }: PropertiesClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [properties, setProperties] = useState<Property[]>(initialProperties);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);

  const handleCreate = async (data: PropertyInput) => {
    const result = await createProperty(data);

    if (result.error) {
      if (result.upgrade) {
        toast.error(result.error);
        return;
      }
      toast.error(result.error);
      return;
    }

    toast.success("Propiedad creada correctamente");
    setIsCreateOpen(false);
    setProperties((prev) => [
      {
        id: result.property!.id,
        name: data.name,
        type: data.type,
        unitsAvailable: data.unitsAvailable,
        dailyPrice: String(data.dailyPrice),
        monthlyPrice: data.monthlyPrice ? String(data.monthlyPrice) : null,
        mainImage: data.mainImage ?? null,
        color: data.color,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    startTransition(() => {
      router.refresh();
    });
  };

  const handleUpdate = async (data: PropertyInput) => {
    if (!editingProperty) return;

    const result = await updateProperty(editingProperty.id, data);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Propiedad actualizada correctamente");
    setEditingProperty(null);
    setProperties((prev) =>
      prev.map((p) =>
        p.id === editingProperty.id
          ? {
              ...p,
              name: data.name,
              type: data.type,
              unitsAvailable: data.unitsAvailable,
              dailyPrice: String(data.dailyPrice),
              monthlyPrice: data.monthlyPrice ? String(data.monthlyPrice) : null,
              color: data.color,
              mainImage: data.mainImage ?? null,
            }
          : p
      )
    );
    startTransition(() => {
      router.refresh();
    });
  };

  const handleDelete = async () => {
    if (!propertyToDelete) return;

    const result = await deleteProperty(propertyToDelete.id);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Propiedad eliminada");
    setProperties((prev) => prev.filter((p) => p.id !== propertyToDelete.id));
    setPropertyToDelete(null);
    startTransition(() => {
      router.refresh();
    });
  };

  const filteredProperties = properties.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Propiedades</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Gestiona tus propiedades y sus configuraciones</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="sm:inline">Nueva Propiedad</span>
          </Button>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nueva Propiedad</DialogTitle>
            </DialogHeader>
            <PropertyForm
              onSubmit={handleCreate}
              onCancel={() => setIsCreateOpen(false)}
              usedColors={usedColors}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Input
          placeholder="Buscar propiedades..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:max-w-sm"
        />
        <Select value={typeFilter} onValueChange={(value: string | null) => { if (value) setTypeFilter(value); }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {PROPERTY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredProperties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
            <div className="relative flex size-16 items-center justify-center rounded-full border border-border bg-card">
              <Building2 className="size-7 text-muted-foreground" />
            </div>
          </div>
          <h3 className="text-lg font-semibold">No hay propiedades</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crea tu primera propiedad para comenzar</p>
          <Button onClick={() => setIsCreateOpen(true)} className="mt-6" size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Crear Propiedad
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 lg:gap-4">
          {filteredProperties.map((property) => (
            <PropertyCardGrid
              key={property.id}
              property={property}
              onEdit={() => setEditingProperty(property)}
              onDelete={() => setPropertyToDelete(property)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!editingProperty} onOpenChange={() => setEditingProperty(null)}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Propiedad</DialogTitle>
          </DialogHeader>
          {editingProperty && (
            <PropertyForm
              initialData={{
                name: editingProperty.name,
                type: editingProperty.type,
                unitsAvailable: editingProperty.unitsAvailable,
                dailyPrice: Number(editingProperty.dailyPrice),
                monthlyPrice: editingProperty.monthlyPrice ? Number(editingProperty.monthlyPrice) : null,
                color: editingProperty.color,
                mainImage: editingProperty.mainImage,
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingProperty(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!propertyToDelete}
        onOpenChange={(open) => {
          if (!open) setPropertyToDelete(null);
        }}
        title="Eliminar propiedad"
        description={`Se eliminará ${propertyToDelete?.name ?? "esta propiedad"}. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar propiedad"
        onConfirm={handleDelete}
      />
    </div>
  );
}
