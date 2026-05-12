"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Grid, List, Pencil, Trash2 } from "lucide-react";
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
import { PropertyFormSections as PropertyForm } from "@/components/properties/property-form-sections";
import { PropertyCardLine, PropertyCardGrid } from "@/components/properties/property-card";
import { toast } from "sonner";
import { createProperty, updateProperty, deleteProperty } from "@/lib/actions/properties";
import type { PropertyInput } from "@/lib/validations/property";

interface Property {
  id: string;
  name: string;
  type: string;
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
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta propiedad?")) return;

    const result = await deleteProperty(id);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Propiedad eliminada");
    setProperties((prev) => prev.filter((p) => p.id !== id));
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
        <div className="flex gap-2">
          <div className="flex border rounded-md">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 ${viewMode === "grid" ? "bg-muted" : ""}`}
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 ${viewMode === "table" ? "bg-muted" : ""}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="sm:inline">Nueva Propiedad</span>
            </Button>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar propiedades..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select value={typeFilter} onValueChange={(value: string | null) => { if (value) setTypeFilter(value); }}>
          <SelectTrigger className="w-40">
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
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No hay propiedades</h3>
          <p className="text-muted-foreground mb-4">Crea tu primera propiedad para comenzar</p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Propiedad
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {filteredProperties.map((property) => (
            <PropertyCardGrid
              key={property.id}
              property={property}
              onEdit={() => setEditingProperty(property)}
              onDelete={() => handleDelete(property.id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProperties.map((property) => (
            <PropertyCardLine
              key={property.id}
              property={property}
              onEdit={() => setEditingProperty(property)}
              onDelete={() => handleDelete(property.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={!!editingProperty} onOpenChange={() => setEditingProperty(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Propiedad</DialogTitle>
          </DialogHeader>
          {editingProperty && (
            <PropertyForm
              initialData={{
                name: editingProperty.name,
                type: editingProperty.type as any,
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
    </div>
  );
}