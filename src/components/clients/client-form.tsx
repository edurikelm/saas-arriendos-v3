"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, type ClientInput } from "@/lib/validations/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ClientFormProps {
  initialData?: Partial<ClientInput>;
  onSubmit: (data: ClientInput) => Promise<void>;
  onCancel?: () => void;
  serverError?: string;
}

export function ClientForm({
  initialData,
  onSubmit,
  onCancel,
  serverError: externalServerError,
}: ClientFormProps) {
  const [serverError, setServerError] = useState(externalServerError);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync local state to a derived prop
    setServerError(externalServerError);
  }, [externalServerError]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      rut: initialData?.rut || "",
      notes: initialData?.notes || "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre completo *</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Juan Pérez"
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico *</Label>
        <Input
          id="email"
          type="email"
          {...register("email", {
            onChange: () => setServerError(undefined),
          })}
          placeholder="juan@ejemplo.com"
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
        {serverError && (
          <p className="text-sm text-red-500">{serverError}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            {...register("phone")}
            placeholder="+56 9 1234 5678"
          />
          {errors.phone && (
            <p className="text-sm text-red-500">{errors.phone.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="rut">RUT</Label>
          <Input
            id="rut"
            {...register("rut")}
            placeholder="12.345.678-9"
          />
          {errors.rut && (
            <p className="text-sm text-red-500">{errors.rut.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          placeholder="Notas sobre el cliente..."
          className="resize-none"
        />
        {errors.notes && (
          <p className="text-sm text-red-500">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar Cliente"}
        </Button>
      </div>
    </form>
  );
}
