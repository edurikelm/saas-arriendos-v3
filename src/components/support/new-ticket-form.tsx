"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createSupportTicket, getUserEntityOptions, type EntityOption } from "@/lib/actions/support";
import {
  ticketCategoryEnum,
  ticketPriorityEnum,
  affectedEntityTypeEnum,
  supportAttachmentSchema,
  type AttachmentInput,
} from "@/lib/validations/support";
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
import { toast } from "sonner";

// Local schema mirrors supportTicketSchema but with flexible category (accepts
// empty string at intermediate state, refined to enum on submit). Defined outside
// component for resolver caching per react-hook-form best practices.
const newTicketFormSchema = z
  .object({
    subject: z
      .string()
      .min(5, "El asunto debe tener al menos 5 caracteres")
      .max(120, "El asunto no puede exceder 120 caracteres"),
    description: z
      .string()
      .min(20, "La descripción debe tener al menos 20 caracteres")
      .max(2000, "La descripción no puede exceder 2000 caracteres"),
    priority: ticketPriorityEnum,
    category: ticketCategoryEnum.or(z.literal("")).refine(
      (v): v is (typeof ticketCategoryEnum._type) => v !== "",
      { message: "Selecciona una categoría" }
    ),
    images: z.array(supportAttachmentSchema).max(3, "Máximo 3 imágenes por mensaje").optional(),
    affectedEntityType: affectedEntityTypeEnum.optional(),
    affectedEntityId: z.string().min(1, "ID de entidad requerido").optional(),
  })
  .refine(
    (data) => {
      if (data.affectedEntityType && !data.affectedEntityId) return false;
      if (!data.affectedEntityType && data.affectedEntityId) return false;
      return true;
    },
    { message: "affectedEntityType y affectedEntityId deben ir juntos" }
  );

type NewTicketFormValues = z.infer<typeof newTicketFormSchema>;

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

  // Local (non-serializable) state — kept outside form state per plan decision
  const [images, setImages] = useState<AttachmentInput[]>([]);
  const [uploading, setUploading] = useState(false);
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<NewTicketFormValues>({
    resolver: zodResolver(newTicketFormSchema),
    defaultValues: {
      subject: "",
      description: "",
      priority: "MEDIUM",
      category: undefined,
      affectedEntityId: undefined,
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  // Reactive derived value from form state (sub-usewatch-over-watch)
  const category = useWatch({ control, name: "category" });
  const affectedEntityType = entityCategoryMap[category ?? ""] || null;

  // Async load entity options when affectedEntityType changes
  useEffect(() => {
    if (!affectedEntityType) {
      setEntityOptions([]);
      setIsLoadingEntities(false);
      return;
    }
    let cancelled = false;
    setIsLoadingEntities(true);
    getUserEntityOptions(affectedEntityType).then((options) => {
      if (cancelled) return;
      setEntityOptions(options);
      setIsLoadingEntities(false);
    });
    return () => {
      cancelled = true;
    };
  }, [affectedEntityType]);

  const handleCategoryChange = (value: string) => {
    setValue("category", value as (typeof ticketCategoryEnum._type), { shouldValidate: true });
    // Always clear affectedEntityId when category changes
    setValue("affectedEntityId", undefined, { shouldValidate: false });
    setEntityOptions([]);
  };

  const onSubmit = async (values: NewTicketFormValues) => {
    const resolvedEntityType = entityCategoryMap[values.category];

    const data: Record<string, unknown> = {
      subject: values.subject,
      description: values.description,
      priority: values.priority,
      category: values.category,
      images,
    };

    // Only include affectedEntity if both type and id are present
    if (resolvedEntityType && values.affectedEntityId?.trim()) {
      data.affectedEntityType = resolvedEntityType;
      data.affectedEntityId = values.affectedEntityId.trim();
    }

    const result = await createSupportTicket(data);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    router.push("/support");
  };

  // onInvalid fires when Zod validation fails in onSubmit mode
  const onInvalid = (formErrors: FieldErrors<NewTicketFormValues>) => {
    const firstError = Object.values(formErrors).find(
      (e): e is NonNullable<typeof e> => !!e
    );
    if (firstError?.message) {
      toast.error(firstError.message);
    }
  };

  const affectedEntityLabel =
    affectedEntityType === "RESERVATION"
      ? "reserva"
      : affectedEntityType === "PAYMENT"
        ? "reserva asociada al pago"
        : "propiedad";

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="subject">Asunto</Label>
        <Input
          id="subject"
          {...register("subject")}
          placeholder="Ej: Problema con el calendario de reservas"
        />
        {errors.subject && (
          <p className="text-sm text-destructive">{errors.subject.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Categoría</Label>
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <Select
              value={field.value ?? ""}
              onValueChange={(val) => {
                if (!val) return;
                field.onChange(val);
                handleCategoryChange(val);
              }}
            >
              <SelectTrigger id="category">
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
          )}
        />
        {errors.category && (
          <p className="text-sm text-destructive">{errors.category.message}</p>
        )}
      </div>

      {affectedEntityType && (
        <div className="space-y-2">
          <Label htmlFor="affectedEntityId">
            {affectedEntityType === "RESERVATION"
              ? "Reserva"
              : affectedEntityType === "PAYMENT"
                ? "Reserva (Pago)"
                : "Propiedad"}{" "}
            (opcional)
          </Label>
          <Controller
            control={control}
            name="affectedEntityId"
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={field.onChange}
                disabled={isLoadingEntities}
              >
                <SelectTrigger id="affectedEntityId">
                  <SelectValue
                    placeholder={
                      isLoadingEntities
                        ? "Cargando..."
                        : `Selecciona una ${affectedEntityLabel}`
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {entityOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="priority">Prioridad</Label>
        <Controller
          control={control}
          name="priority"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="priority">
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
          )}
        />
        {errors.priority && (
          <p className="text-sm text-destructive">{errors.priority.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Imágenes (opcional)</Label>
        <SupportImageUpload
          images={images}
          onChange={setImages}
          onUploadingChange={setUploading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Describe tu problema o consulta en detalle..."
          rows={6}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
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
