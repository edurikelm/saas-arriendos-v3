"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Grid, List, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PropertyForm } from "@/components/properties/property-form";
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const res = await fetch("/api/properties");
      if (res.ok) {
        const data = await res.json();
        setProperties(data);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setLoading(false);
    }
  };

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

    setIsCreateOpen(false);
    fetchProperties();
  };

  const handleUpdate = async (data: PropertyInput) => {
    if (!editingProperty) return;

    const res = await fetch(`/api/properties/${editingProperty.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (result.error) {
      throw new Error(result.error);
    }

    setEditingProperty(null);
    fetchProperties();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta propiedad?")) return;

    const res = await fetch(`/api/properties/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      fetchProperties();
    }
  };

  const filteredProperties = properties.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const typeLabels: Record<string, string> = {
    HOUSE: "Casa",
    APARTMENT: "Departamento",
    CABIN: "Cabaña",
    HOSTEL: "Hostel",
    HOTEL: "Hotel",
    OFFICE: "Oficina",
    COMMERCIAL: "Comercial",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Propiedades</h1>
          <p className="text-muted-foreground">Gestiona tus propiedades y sus configuraciones</p>
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
                Nueva Propiedad
              </Button>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crear Nueva Propiedad</DialogTitle>
              </DialogHeader>
              <PropertyForm onSubmit={handleCreate} onCancel={() => setIsCreateOpen(false)} />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((property) => (
            <Card key={property.id} className="overflow-hidden">
              <div
                className="h-32 w-full"
                style={{ backgroundColor: property.color + "20" }}
              >
                {property.mainImage && (
                  <img
                    src={property.mainImage}
                    alt={property.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <CardHeader>
                <CardTitle>{property.name}</CardTitle>
                <CardDescription>{typeLabels[property.type] || property.type}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unidades:</span>
                    <span className="font-medium">{property.unitsAvailable}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Precio diario:</span>
                    <span className="font-medium">${Number(property.dailyPrice).toLocaleString("CLP")}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setEditingProperty(property)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(property.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="p-4 font-medium">Nombre</th>
                  <th className="p-4 font-medium">Tipo</th>
                  <th className="p-4 font-medium">Unidades</th>
                  <th className="p-4 font-medium">Precio Diario</th>
                  <th className="p-4 font-medium">Precio Mensual</th>
                  <th className="p-4 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProperties.map((property) => (
                  <tr key={property.id} className="border-b">
                    <td className="p-4">{property.name}</td>
                    <td className="p-4">{typeLabels[property.type] || property.type}</td>
                    <td className="p-4">{property.unitsAvailable}</td>
                    <td className="p-4">${Number(property.dailyPrice).toLocaleString("CLP")}</td>
                    <td className="p-4">
                      {property.monthlyPrice
                        ? `$${Number(property.monthlyPrice).toLocaleString("CLP")}`
                        : "-"}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
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