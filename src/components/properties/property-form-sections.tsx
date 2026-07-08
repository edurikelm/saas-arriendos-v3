"use client";

import Image from "next/image";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { propertySchema, type PropertyInput } from "@/lib/validations/property";
import { useState } from "react";
import { Upload, X, Info, Box, CircleDollarSign, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
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

interface PropertyFormSectionsProps {
  id?: string;
  initialData?: Partial<PropertyInput>;
  onSubmit: (data: PropertyInput) => Promise<void>;
  onCancel?: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

const labelClassName = "text-xs font-bold text-muted-foreground uppercase tracking-tighter mb-1";
const errorClassName = "text-xs text-destructive mt-1";

export function PropertyFormSections({
  id,
  initialData,
  onSubmit,
  onCancel,
  onSubmittingChange,
}: PropertyFormSectionsProps) {
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

  const selectedType = useWatch({ control, name: "type" });

  const handleFormSubmit = async (data: PropertyInput) => {
    setIsSubmitting(true);
    onSubmittingChange?.(true);
    try {
      await onSubmit({
        ...data,
        mainImage,
        images,
      });
    } finally {
      setIsSubmitting(false);
      onSubmittingChange?.(false);
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

  return (
    <form
      id={id}
      onSubmit={handleSubmit(handleFormSubmit)}
      className="w-full"
    >
      <div className="p-6 space-y-6">
        {/* Sección 1: Información General */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Info className="size-5 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Información General
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name" className={labelClassName}>Nombre</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Departamento Centro"
              />
              {errors.name && <p className={errorClassName}>{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="type" className={labelClassName}>Tipo</Label>
              <Select
                value={selectedType}
                onValueChange={(value) => setValue("type", value as PropertyInput["type"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar tipo">
                    {PROPERTY_TYPES.find((t) => t.value === selectedType)?.label ?? "Seleccionar tipo"}
                  </SelectValue>
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
          </div>
        </section>

        {/* Sección 2: Capacidad */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Box className="size-5 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Capacidad
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="unitsAvailable" className={labelClassName}>Unidades disponibles</Label>
              <Input
                id="unitsAvailable"
                type="number"
                min={1}
                {...register("unitsAvailable", { valueAsNumber: true })}
              />
              {errors.unitsAvailable && <p className={errorClassName}>{errors.unitsAvailable.message}</p>}
            </div>
          </div>
        </section>

        {/* Sección 3: Tarifas */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <CircleDollarSign className="size-5 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Tarifas
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Controller
              name="dailyPrice"
              control={control}
              render={({ field, fieldState }) => (
                <CurrencyInput
                  id="dailyPrice"
                  label="Precio por noche (CLP)"
                  required
                  value={field.value || null}
                  onChange={(v) => field.onChange(v ?? 0)}
                  error={fieldState.error?.message}
                  placeholder="85000"
                />
              )}
            />
            <Controller
              name="monthlyPrice"
              control={control}
              render={({ field, fieldState }) => (
                <CurrencyInput
                  id="monthlyPrice"
                  label="Precio mensual (CLP, opcional)"
                  value={field.value ?? null}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                  placeholder="1800000"
                />
              )}
            />
          </div>
        </section>

        {/* Sección 4: Multimedia */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <ImageIcon className="size-5 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Multimedia
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Imagen principal */}
            <div className="space-y-1">
              <Label className={labelClassName}>Imagen principal</Label>
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
            {/* Galería */}
            <div className="space-y-1">
              <Label className={labelClassName}>Galería ({images.length}/10)</Label>
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
                {images.length < 10 && (
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
        </section>
      </div>
    </form>
  );
}
