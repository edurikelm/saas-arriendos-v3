"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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

// Model note: Property has no isActive field yet, so every property is "active".
// The status filter is kept for UI parity with the design reference and is
// forward-compatible: if isActive is added to the schema, just thread it
// through getProperties and the filter logic below continues to work.
const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activas" },
];

export function PropertiesClient({ initialProperties }: PropertiesClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [properties, setProperties] = useState<Property[]>(initialProperties);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);

  const handleCreate = async (data: PropertyInput) => {
    const result = await createProperty(data);

    if (result.error) {
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
    const matchesSearch = p.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    // Without isActive on the model, all properties match "all" and "active".
    const matchesStatus = statusFilter !== "inactive";
    return matchesSearch && matchesType && matchesStatus;
  });

  const hasActiveFilters =
    searchQuery !== "" || typeFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Propiedades</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona tu portafolio de unidades de alquiler
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          <span className="sm:inline">Nueva propiedad</span>
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar propiedad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={typeFilter}
            onValueChange={(value: string | null) => {
              if (value) setTypeFilter(value);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Tipo: Todos">
                {typeFilter === "all"
                  ? "Tipo: Todos"
                  : PROPERTY_TYPES.find((t) => t.value === typeFilter)?.label ?? "Tipo: Todos"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tipo: Todos</SelectItem>
              {PROPERTY_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value: string | null) => {
              if (value) setStatusFilter(value);
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Estado: Todos">
                {statusFilter === "all"
                  ? "Estado: Todos"
                  : `Estado: ${STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label ?? "Todos"}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.value === "all"
                    ? "Estado: Todos"
                    : `Estado: ${status.label}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {properties.length > 0 ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Mostrando {filteredProperties.length} de {properties.length}{" "}
              {properties.length === 1 ? "propiedad" : "propiedades"}
            </p>
            {hasActiveFilters ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                <X className="size-3" />
                Limpiar filtros
              </Button>
            ) : null}
          </div>
        ) : null}

          {properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
                <div className="relative flex size-16 items-center justify-center rounded-full border border-border bg-card">
                  <Building2 className="size-7 text-muted-foreground" />
                </div>
              </div>
              <h3 className="text-lg font-semibold">No hay propiedades</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Crea tu primera propiedad para comenzar
              </p>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="mt-6"
                size="lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear propiedad
              </Button>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="mt-2 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-12">
              <p className="text-sm text-muted-foreground">
                No hay propiedades que coincidan con los filtros actuales
              </p>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="size-3.5" />
                Limpiar filtros
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
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
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="h-16 px-6 border-b border-border flex-row items-center justify-between space-y-0 shrink-0">
            <DialogTitle className="text-lg font-bold">Crear Nueva Propiedad</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PropertyForm
              id="property-form"
              onSubmit={handleCreate}
              onSubmittingChange={(submitting) => setIsSubmitting(submitting)}
            />
          </div>
          <DialogFooter className="h-20 px-6 border-t sm:justify-end gap-3 bg-transparent shrink-0">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="property-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Guardando..." : "Crear propiedad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProperty} onOpenChange={() => setEditingProperty(null)}>
        <DialogContent className="w-[95vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="h-16 px-6 border-b border-border flex-row items-center justify-between space-y-0 shrink-0">
            <DialogTitle className="text-lg font-bold">Editar Propiedad</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {editingProperty && (
              <PropertyForm
                id="property-form-edit"
                initialData={{
                  name: editingProperty.name,
                  type: editingProperty.type,
                  unitsAvailable: editingProperty.unitsAvailable,
                  dailyPrice: Number(editingProperty.dailyPrice),
                  monthlyPrice: editingProperty.monthlyPrice
                    ? Number(editingProperty.monthlyPrice)
                    : null,
                  mainImage: editingProperty.mainImage,
                }}
                onSubmit={handleUpdate}
                onSubmittingChange={(submitting) => setIsSubmitting(submitting)}
              />
            )}
          </div>
          <DialogFooter className="h-20 px-6 border-t sm:justify-end gap-3 bg-transparent shrink-0">
            <Button variant="outline" onClick={() => setEditingProperty(null)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="property-form-edit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
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
