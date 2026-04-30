"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { propertySchema, type PropertyInput } from "@/lib/validations/property";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const PROPERTY_TYPES = [
  { value: "HOUSE", label: "Casa" },
  { value: "APARTMENT", label: "Departamento" },
  { value: "CABIN", label: "Cabaña" },
  { value: "HOSTEL", label: "Hostel" },
  { value: "HOTEL", label: "Hotel" },
  { value: "OFFICE", label: "Oficina" },
  { value: "COMMERCIAL", label: "Comercial" },
];

const COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

interface PropertyFormProps {
  initialData?: Partial<PropertyInput>;
  onSubmit: (data: PropertyInput) => Promise<void>;
  onCancel?: () => void;
  usedColors?: string[];
}

export function PropertyForm({ initialData, onSubmit, onCancel, usedColors = [] }: PropertyFormProps) {
  const [activeTab, setActiveTab] = useState("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mainImage, setMainImage] = useState<string | null>(initialData?.mainImage || null);
  const [images, setImages] = useState<string[]>(initialData?.images || []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PropertyInput>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: initialData?.name || "",
      type: initialData?.type || "HOUSE",
      unitsAvailable: initialData?.unitsAvailable || 1,
      dailyPrice: initialData?.dailyPrice || 0,
      monthlyPrice: initialData?.monthlyPrice || null,
      currency: initialData?.currency || "CLP",
      amenities: initialData?.amenities || [],
      color: initialData?.color || "#3B82F6",
      mainImage: initialData?.mainImage || null,
      images: initialData?.images || [],
    },
  });

  const handleFormSubmit = async (data: PropertyInput) => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...data,
        mainImage,
        images,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isMain: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For now, just use a placeholder URL
    // In production, upload to Cloudinary
    const fakeUrl = `https://picsum.photos/800/600?random=${Date.now()}`;

    if (isMain) {
      setMainImage(fakeUrl);
      setValue("mainImage", fakeUrl);
    } else {
      const newImages = [...images, fakeUrl];
      setImages(newImages);
      setValue("images", newImages);
    }
  };

  const removeImage = (index: number, isMain: boolean) => {
    if (isMain) {
      setMainImage(null);
      setValue("mainImage", null);
    } else {
      const newImages = images.filter((_, i) => i !== index);
      setImages(newImages);
      setValue("images", newImages);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <TabsList className="shrink-0 bg-background border-b rounded-none px-0 mb-0">
          <TabsTrigger value="basic">Básico</TabsTrigger>
          <TabsTrigger value="rental">Arriendo</TabsTrigger>
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="images">Imágenes</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 flex-1 overflow-auto">
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
              <CardDescription>Nombre y tipo de propiedad</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Propiedad</Label>
                <Input id="name" {...register("name")} placeholder="Departamento Centro" />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Propiedad</Label>
                <Select
                  value={watch("type")}
                  onValueChange={(value) => setValue("type", value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-sm text-red-500">{errors.type.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitsAvailable">Unidades Disponibles</Label>
                <Input
                  id="unitsAvailable"
                  type="number"
                  min={1}
                  {...register("unitsAvailable", { valueAsNumber: true })}
                />
                {errors.unitsAvailable && (
                  <p className="text-sm text-red-500">{errors.unitsAvailable.message}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rental" className="space-y-4 flex-1 overflow-auto">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Arriendo</CardTitle>
              <CardDescription>Precios diarios y mensuales</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dailyPrice">Precio Diario (CLP)</Label>
                <Input
                  id="dailyPrice"
                  type="number"
                  min={0}
                  step={100}
                  {...register("dailyPrice", { valueAsNumber: true })}
                />
                {errors.dailyPrice && (
                  <p className="text-sm text-red-500">{errors.dailyPrice.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyPrice">Precio Mensual (CLP) - Opcional</Label>
                <Input
                  id="monthlyPrice"
                  type="number"
                  min={0}
                  step={100}
                  {...register("monthlyPrice", { valueAsNumber: true })}
                  placeholder="Precio fijo mensual"
                />
                {errors.monthlyPrice && (
                  <p className="text-sm text-red-500">{errors.monthlyPrice.message}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4 flex-1 overflow-auto">
          <Card>
            <CardHeader>
              <CardTitle>Detalles y Amenidades</CardTitle>
              <CardDescription>Color y amenidades de la propiedad</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Color para Calendario</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((color) => {
                    const isUsed = usedColors.includes(color) && color !== initialData?.color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => !isUsed && setValue("color", color)}
                        disabled={isUsed}
                        className={`w-8 h-8 rounded-full border-2 ${
                          watch("color") === color ? "border-black" : "border-transparent"
                        } ${isUsed ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                        style={{ backgroundColor: color }}
                        title={isUsed ? "Color en uso por otra propiedad" : color}
                      />
                    );
                  })}
                </div>
                {errors.color && <p className="text-sm text-red-500">{errors.color.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amenities">Amenidades (separadas por coma)</Label>
                <Input
                  id="amenities"
                  placeholder="WiFi, Estacionamiento, Piscina"
                  onChange={(e) => {
                    const amenities = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                    setValue("amenities", amenities);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images" className="space-y-4 flex-1 overflow-auto">
          <Card>
            <CardHeader>
              <CardTitle>Imágenes de la Propiedad</CardTitle>
              <CardDescription>Imagen principal y galería</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Imagen Principal</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  {mainImage ? (
                    <div className="relative">
                      <img
                        src={mainImage}
                        alt="Main"
                        className="mx-auto max-h-48 rounded object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="mt-2"
                        onClick={() => removeImage(0, true)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  ) : (
                    <div className="py-8">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, true)}
                        className="hidden"
                        id="main-image-upload"
                      />
                      <label
                        htmlFor="main-image-upload"
                        className="cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        Click para subir imagen principal
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Imágenes Adicionales</Label>
                <div className="border-2 border-dashed rounded-lg p-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, false)}
                    className="hidden"
                    id="images-upload"
                  />
                  <label
                    htmlFor="images-upload"
                    className="cursor-pointer text-muted-foreground hover:text-foreground block text-center py-4"
                  >
                    Click para agregar más imágenes
                  </label>
                  {images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {images.map((img, index) => (
                        <div key={index} className="relative">
                          <img
                            src={img}
                            alt={`Image ${index + 1}`}
                            className="w-full h-24 object-cover rounded"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index, false)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <div className="shrink-0 flex justify-end gap-4 pt-4 border-t mt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar Propiedad"}
          </Button>
        </div>
      </Tabs>
    </form>
  );
}