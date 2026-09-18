"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { brokerSchema, type BrokerInput } from "@/lib/validations/broker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BrokerFormProps {
  initialData?: Partial<BrokerInput>;
  onSubmit: (data: BrokerInput) => Promise<void>;
  onCancel?: () => void;
  /** true cuando el captador ya tiene reservas registradas. */
  hasReservations?: boolean;
}

export function BrokerForm({
  initialData,
  onSubmit,
  onCancel,
  hasReservations,
}: BrokerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BrokerInput>({
    resolver: zodResolver(brokerSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      rut: initialData?.rut || "",
      // Sin precargar 0 al crear: un campo obligatorio que ya trae un número
      // válido se puede guardar sin mirarlo, y 0% es un captador que no cobra.
      // Vacío obliga a escribirlo; el editar sí trae su valor.
      defaultCommissionRate: initialData?.defaultCommissionRate ?? undefined,
      notes: initialData?.notes || "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre completo *</Label>
        <Input id="name" {...register("name")} placeholder="Ana Rojas" />
        {errors.name && (
          <p className="text-sm text-destructive-text">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="defaultCommissionRate">Comisión por defecto (%) *</Label>
        <Input
          id="defaultCommissionRate"
          type="number"
          step="0.01"
          min="0"
          max="100"
          {...register("defaultCommissionRate", { valueAsNumber: true })}
          placeholder="10"
        />
        <p className="text-xs text-muted-foreground">
          {hasReservations
            ? "Se usa al asignarlo a una reserva nueva. Las reservas ya registradas conservan el porcentaje con el que se crearon."
            : "Se precarga al asignarlo a una reserva, y podés ajustarlo caso a caso."}
        </p>
        {errors.defaultCommissionRate && (
          <p className="text-sm text-destructive-text">
            {errors.defaultCommissionRate.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" {...register("phone")} placeholder="+56 9 1234 5678" />
          {errors.phone && (
            <p className="text-sm text-destructive-text">{errors.phone.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="rut">RUT</Label>
          <Input id="rut" {...register("rut")} placeholder="12.345.678-9" />
          {errors.rut && (
            <p className="text-sm text-destructive-text">{errors.rut.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          placeholder="ana@ejemplo.com"
        />
        {errors.email && (
          <p className="text-sm text-destructive-text">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          placeholder="Cómo trabaja, qué propiedades cubre..."
          className="resize-none"
        />
        {errors.notes && (
          <p className="text-sm text-destructive-text">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar Captador"}
        </Button>
      </div>
    </form>
  );
}
