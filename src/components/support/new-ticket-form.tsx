"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createSupportTicket, getUserEntityOptions, type EntityOption } from "@/lib/actions/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupportImageUpload } from "./support-image-upload";
import type { AttachmentInput } from "@/lib/validations/support";

const categoryOptions = [
  { value: "RESERVATIONS", label: "Reservas" },
  { value: "PAYMENTS", label: "Pagos" },
  { value: "PROPERTIES", label: "Propiedades" },
  { value: "ACCOUNT", label: "Cuenta" },
  { value: "OTHER", label: "Otro" },
];

const priorityOptions = [
  { value: "LOW", label: "Baja" },
  { value: "MEDIUM", label: "Media" },
  { value: "HIGH", label: "Alta" },
];

const entityCategoryMap: Record<string, "RESERVATION" | "PAYMENT" | "PROPERTY" | null> = {
  RESERVATIONS: "RESERVATION",
  PAYMENTS: "PAYMENT",
  PROPERTIES: "PROPERTY",
  ACCOUNT: null,
  OTHER: null,
};

export function NewTicketForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [images, setImages] = useState<AttachmentInput[]>([]);
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");

  const affectedEntityType = entityCategoryMap[selectedCategory] || null;

  useEffect(() => {
    if (!affectedEntityType) return;
    let cancelled = false;
    getUserEntityOptions(affectedEntityType).then((options) => {
      if (cancelled) return;
      setEntityOptions(options);
      setIsLoadingEntities(false);
    });
    return () => {
      cancelled = true;
    };
  }, [affectedEntityType]);

  const handleCategoryChange = useCallback((value: string | null) => {
    if (!value) return;
    setSelectedCategory(value);
    setSelectedEntityId("");
    setEntityOptions([]);
    if (entityCategoryMap[value]) {
      setIsLoadingEntities(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      subject: formData.get("subject") as string,
      description: formData.get("description") as string,
      priority: formData.get("priority") as string,
      category: formData.get("category") as string,
      images,
    };

    if (affectedEntityType && selectedEntityId?.trim()) {
      data.affectedEntityType = affectedEntityType;
      data.affectedEntityId = selectedEntityId.trim();
    }

    const result = await createSupportTicket(data);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    router.push("/support");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="subject">Asunto</Label>
        <Input
          id="subject"
          name="subject"
          placeholder="Ej: Problema con el calendario de reservas"
          required
          minLength={5}
          maxLength={120}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Categoría</Label>
        <Select
          name="category"
          required
          value={selectedCategory}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una categoría" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {affectedEntityType && (
        <div className="space-y-2">
          <Label htmlFor="affectedEntityId">
            {affectedEntityType === "RESERVATION" ? "Reserva" : affectedEntityType === "PAYMENT" ? "Reserva (Pago)" : "Propiedad"} (opcional)
          </Label>
          <Select
            name="affectedEntityId"
            value={selectedEntityId}
            onValueChange={(value) => value && setSelectedEntityId(value)}
            disabled={isLoadingEntities}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingEntities ? "Cargando..." : `Selecciona una ${affectedEntityType === "RESERVATION" ? "reserva" : affectedEntityType === "PAYMENT" ? "reserva asociada al pago" : "propiedad"}`} />
            </SelectTrigger>
            <SelectContent>
              {entityOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="priority">Prioridad</Label>
        <Select name="priority" required>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una prioridad" />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Imágenes (opcional)</Label>
        <SupportImageUpload images={images} onChange={setImages} onUploadingChange={setUploading} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Describe tu problema o consulta en detalle..."
          required
          minLength={20}
          maxLength={2000}
          rows={6}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting || uploading}>
          {isSubmitting ? "Enviando..." : "Crear Ticket"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/support")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
