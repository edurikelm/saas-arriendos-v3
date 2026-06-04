"use client";

import Image from "next/image";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { propertySchema, type PropertyInput } from "@/lib/validations/property";
import { useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
];

interface PropertyFormSectionsProps {
  initialData?: Partial<PropertyInput>;
  onSubmit: (data: PropertyInput) => Promise<void>;
  onCancel?: () => void;
  usedColors?: string[];
}

export function PropertyFormSections({ initialData, onSubmit, onCancel, usedColors = [] }: PropertyFormSectionsProps) {
  const [section, setSection] = useState<"basic" | "pricing" | "media">("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mainImage, setMainImage] = useState<string | null>(initialData?.mainImage || null);
  const [images, setImages] = useState<string[]>(initialData?.images || []);

  const {
    register,
    handleSubmit,
    setValue,
    control,
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

  const selectedColor = useWatch({ control, name: "color" });
  const selectedType = useWatch({ control, name: "type" });

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

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const { url } = await res.json();

      if (isMain) {
        setMainImage(url);
        setValue("mainImage", url);
      } else {
        const newImages = [...images, url];
        setImages(newImages);
        setValue("images", newImages);
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Error al subir imagen");
    } finally {
      setIsUploading(false);
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

  const sections = [
    { id: "basic" as const, label: "Básico" },
    { id: "pricing" as const, label: "Precios" },
    { id: "media" as const, label: "Imágenes" },
  ];

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-w-md">
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
              section === s.id ? "bg-background shadow-sm" : "hover:bg-muted/50"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {section === "basic" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs uppercase tracking-wide text-muted-foreground">
                Nombre
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Departamento Centro"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="text-xs uppercase tracking-wide text-muted-foreground">
                Tipo de propiedad
              </Label>
              <Select
                value={selectedType}
                onValueChange={(value) => setValue("type", value as PropertyInput["type"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitsAvailable" className="text-xs uppercase tracking-wide text-muted-foreground">
                Unidades disponibles
              </Label>
              <Input
                id="unitsAvailable"
                type="number"
                min={1}
                {...register("unitsAvailable", { valueAsNumber: true })}
              />
              {errors.unitsAvailable && <p className="text-xs text-destructive">{errors.unitsAvailable.message}</p>}
            </div>
          </>
        )}

        {section === "pricing" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="dailyPrice" className="text-xs uppercase tracking-wide text-muted-foreground">
                Precio por noche
              </Label>
              <Input
                id="dailyPrice"
                type="number"
                min={0}
                step={100}
                {...register("dailyPrice", { valueAsNumber: true })}
                placeholder="85000"
              />
              {errors.dailyPrice && <p className="text-xs text-destructive">{errors.dailyPrice.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyPrice" className="text-xs uppercase tracking-wide text-muted-foreground">
                Precio mensual (opcional)
              </Label>
              <Input
                id="monthlyPrice"
                type="number"
                min={0}
                step={100}
                {...register("monthlyPrice", { valueAsNumber: true })}
                placeholder="1800000"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Color del calendario</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => {
                  const isUsed = usedColors.includes(color) && color !== initialData?.color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setValue("color", color)}
                      disabled={isUsed}
                      className={cn(
                        "h-8 w-8 rounded-md transition-transform hover:scale-110",
                        selectedColor === color ? "ring-2 ring-offset-2 ring-primary" : "",
                        isUsed && "opacity-30 cursor-not-allowed"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}

        {section === "media" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Imagen principal</Label>
              <div className="relative aspect-video rounded-lg border-2 border-dashed border-border bg-muted/30 overflow-hidden">
                {mainImage ? (
                  <>
                    <Image src={mainImage} alt="Main" width={400} height={225} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(0, true)}
                      className="absolute top-2 right-2 h-6 w-6 rounded-md bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-full gap-2 text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    {isUploading ? (
                      <>
                        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <span className="text-xs">Subiendo...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5" />
                        <span className="text-xs">Subir imagen</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, true)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Galería ({images.length}/6)
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-border">
                    <Image src={img} alt="" width={100} height={100} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i, false)}
                      className="absolute top-1 right-1 h-4 w-4 rounded-md bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="h-2 w-2" />
                    </button>
                  </div>
                ))}
                {images.length < 6 && (
                  <label className="aspect-square rounded-md border-2 border-dashed border-border bg-muted/30 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, false)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
