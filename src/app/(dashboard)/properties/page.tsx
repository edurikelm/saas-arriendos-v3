"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Grid, List, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PropertyForm } from "@/components/properties/property-form";
import { PropertyCardMinimal } from "@/prototypes/property-card-prototypes";
import { toast } from "sonner";
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

export default function PropertiesPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [usedColors, setUsedColors] = useState<string[]>([]);

  useEffect(() => {
    fetchProperties();
  }, [typeFilter]);

  const fetchProperties = async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") {
        params.append("type", typeFilter);
      }

      const [propsRes, colorsRes] = await Promise.all([
        fetch(`/api/properties?${params.toString()}`),
        fetch("/api/properties?type=colors"),
      ]);

      if (!propsRes.ok) {
        toast.error("Error al cargar propiedades");
        return;
      }
      const data = await propsRes.json();
      setProperties(data);

      if (colorsRes.ok) {
        const colors = await colorsRes.json();
        setUsedColors(colors);
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: PropertyInput) => {
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

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
      fetchProperties();
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleUpdate = async (data: PropertyInput) => {
    if (!editingProperty) return;

    try {
      const res = await fetch(`/api/properties/${editingProperty.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Propiedad actualizada correctamente");
      setEditingProperty(null);
      fetchProperties();
    } catch {
      toast.error("Error de conexión");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta propiedad?")) return;

    try {
      const res = await fetch(`/api/properties/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        toast.error("Error al eliminar propiedad");
        return;
      }

      toast.success("Propiedad eliminada");
      fetchProperties();
    } catch {
      toast.error("Error de conexión");
    }
  };

  const filteredProperties = properties.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const typeLabels: Record<string, string> = {
    HOUSE: "Casa",
    APARTMENT: "Departamento",
    CABIN: "Cabaña",
    HOSTEL: "Hostel",
    HOTEL: "Hotel",
    OFFICE: "Oficina",
    COMMERCIAL: "Comercial",
  };

  const PROPERTY_TYPES = [
    { value: "HOUSE", label: "Casa" },
    { value: "APARTMENT", label: "Departamento" },
    { value: "CABIN", label: "Cabaña" },
    { value: "HOSTEL", label: "Hostel" },
    { value: "HOTEL", label: "Hotel" },
    { value: "OFFICE", label: "Oficina" },
    { value: "COMMERCIAL", label: "Comercial" },
  ];

  const handleTypeFilterChange = (value: string | null) => {
    if (value) setTypeFilter(value);
  };

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
            <Button onClick={() => setIsCreateOpen(true)} size="sm">
              <Plus className="h-4 w-4" />
              <span className="sm:inline ml-2">Nueva Propiedad</span>
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
        <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
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

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando...</div>
      ) : filteredProperties.length === 0 ? (
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
            <PropertyCardMinimal
              key={property.id}
              property={property}
              onEdit={() => setEditingProperty(property)}
              onDelete={() => handleDelete(property.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <CardContent className="p-0 min-w-[640px]">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left text-sm">
                  <th className="p-3 lg:p-4 font-medium">Nombre</th>
                  <th className="p-3 lg:p-4 font-medium">Tipo</th>
                  <th className="p-3 lg:p-4 font-medium">Unidades</th>
                  <th className="p-3 lg:p-4 font-medium">Precio Diario</th>
                  <th className="p-3 lg:p-4 font-medium">Precio Mensual</th>
                  <th className="p-3 lg:p-4 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.map((property) => (
                  <tr key={property.id} className="border-b text-sm">
                    <td className="p-3 lg:p-4">{property.name}</td>
                    <td className="p-3 lg:p-4">{typeLabels[property.type] || property.type}</td>
                    <td className="p-3 lg:p-4">{property.unitsAvailable}</td>
                    <td className="p-3 lg:p-4">${Number(property.dailyPrice).toLocaleString("CLP")}</td>
                    <td className="p-3 lg:p-4">
                      {property.monthlyPrice
                        ? `$${Number(property.monthlyPrice).toLocaleString("CLP")}`
                        : "-"}
                    </td>
                    <td className="p-3 lg:p-4">
                      <div className="flex gap-1 lg:gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingProperty(property)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(property.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
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