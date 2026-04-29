"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { reservationSchema, type ReservationInput } from "@/lib/validations/reservation";
import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";

interface ReservationFormProps {
  properties: Array<{
    id: string;
    name: string;
    unitsAvailable: number;
    dailyPrice: string;
    monthlyPrice: string | null;
  }>;
  clients: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  initialData?: Partial<ReservationInput>;
  onSubmit: (data: ReservationInput) => Promise<void>;
  onCancel?: () => void;
}

export function ReservationForm({
  properties,
  clients,
  initialData,
  onSubmit,
  onCancel,
}: ReservationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDateForInput = (date: Date | string | undefined): string => {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReservationInput>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      propertyId: initialData?.propertyId || "",
      clientId: initialData?.clientId || "",
      startDate: formatDateForInput(initialData?.startDate),
      endDate: formatDateForInput(initialData?.endDate),
      billingType: initialData?.billingType || "DAILY",
      unitsBooked: initialData?.unitsBooked || 1,
      bookingAirbnb: initialData?.bookingAirbnb || false,
      notes: initialData?.notes || "",
    },
  });

  const selectedPropertyId = watch("propertyId");
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  const handleFormSubmit = async (data: ReservationInput) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Propiedad *</Label>
        <Select
          value={selectedPropertyId}
          onValueChange={(value) => setValue("propertyId", value || "")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar propiedad" />
          </SelectTrigger>
          <SelectContent>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.name} ({property.unitsAvailable} unidades)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.propertyId && (
          <p className="text-sm text-red-500">{errors.propertyId.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Cliente *</Label>
        <Select
          value={watch("clientId")}
          onValueChange={(value) => setValue("clientId", value || "")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar cliente" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name} ({client.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.clientId && (
          <p className="text-sm text-red-500">{errors.clientId.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Fecha de Entrada *</Label>
          <Input
            id="startDate"
            type="date"
            {...register("startDate")}
          />
          {errors.startDate && (
            <p className="text-sm text-red-500">{errors.startDate.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">Última Noche *</Label>
          <Input
            id="endDate"
            type="date"
            {...register("endDate")}
          />
          {errors.endDate && (
            <p className="text-sm text-red-500">{errors.endDate.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tipo de Facturación *</Label>
        <Select
          value={watch("billingType")}
          onValueChange={(value) => setValue("billingType", value as "DAILY" | "MONTHLY")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DAILY">Diario</SelectItem>
            <SelectItem value="MONTHLY">Mensual</SelectItem>
          </SelectContent>
        </Select>
        {errors.billingType && (
          <p className="text-sm text-red-500">{errors.billingType.message}</p>
        )}
      </div>

      {selectedProperty && (
        <div className="rounded-lg bg-muted p-4 text-sm">
          <p className="font-medium">Precios:</p>
          <p>Diario: ${Number(selectedProperty.dailyPrice).toLocaleString("CLP")}</p>
          {selectedProperty.monthlyPrice && (
            <p>Mensual: ${Number(selectedProperty.monthlyPrice).toLocaleString("CLP")}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="unitsBooked">Unidades Reservadas *</Label>
        <Input
          id="unitsBooked"
          type="number"
          min={1}
          max={selectedProperty?.unitsAvailable || 1}
          {...register("unitsBooked", { valueAsNumber: true })}
        />
        {errors.unitsBooked && (
          <p className="text-sm text-red-500">{errors.unitsBooked.message}</p>
        )}
        {selectedProperty && (
          <p className="text-xs text-muted-foreground">
            Disponibles: {selectedProperty.unitsAvailable}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="bookingAirbnb"
          checked={watch("bookingAirbnb")}
          onCheckedChange={(checked) => setValue("bookingAirbnb", checked)}
        />
        <Label htmlFor="bookingAirbnb">Reserva de Airbnb</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          placeholder="Notas para esta reserva (ej: necesita sofá cama)..."
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
          {isSubmitting ? "Guardando..." : "Guardar Reserva"}
        </Button>
      </div>
    </form>
  );
}