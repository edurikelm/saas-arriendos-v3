"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { reservationSchema, type ReservationInput } from "@/lib/validations/reservation";
import { z } from "zod";
type ReservationFormData = z.input<typeof reservationSchema>;
import React, { useState, useEffect } from "react";
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
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { getBlockedDates } from "@/lib/actions/reservations";

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
  const [blockedDates, setBlockedDates] = useState<string[]>([]);

  const formatDateForInput = (date: Date | string | undefined): string => {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  };

  const [dateRange, setDateRange] = React.useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: initialData?.startDate
      ? new Date(initialData.startDate)
      : undefined,
    to: initialData?.endDate ? new Date(initialData.endDate) : undefined,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ReservationFormData>({
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

  const handleDateRangeChange = (date: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(date);
    setValue("startDate", date.from ? formatDateForInput(date.from) : "");
    setValue("endDate", date.to ? formatDateForInput(date.to) : "");
  };

  const selectedPropertyId = watch("propertyId");
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const selectedClientId = watch("clientId");
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  useEffect(() => {
    if (selectedPropertyId) {
      getBlockedDates(selectedPropertyId).then(setBlockedDates);
    } else {
      setBlockedDates([]);
    }
  }, [selectedPropertyId]);

  const handleFormSubmit = async (data: ReservationFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data as unknown as ReservationInput);
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
            <SelectValue placeholder="Seleccionar propiedad">
              {selectedProperty ? `${selectedProperty.name} (${selectedProperty.unitsAvailable} disp.)` : "Seleccionar propiedad"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.name} ({property.unitsAvailable} disp.)
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
            <SelectValue placeholder="Seleccionar cliente">
              {selectedClient ? `${selectedClient.name} (${selectedClient.email})` : "Seleccionar cliente"}
            </SelectValue>
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

      <div className="space-y-2">
        <Label>Fechas de Estadía *</Label>
        <DateRangePicker
          date={dateRange}
          onDateChange={handleDateRangeChange}
          className="w-full"
          blockedDates={blockedDates}
        />
        {(errors.startDate || errors.endDate) && (
          <p className="text-sm text-red-500">
            {errors.startDate?.message || errors.endDate?.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Tipo de Facturación *</Label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setValue("billingType", "DAILY")}
            className={`flex-1 h-14 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-0.5 ${
              watch("billingType") === "DAILY"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border"
            }`}
          >
            <span className="text-xs font-medium">Diario</span>
            <span className={`text-sm font-bold ${watch("billingType") === "DAILY" ? "text-primary" : "text-foreground"}`}>
              ${selectedProperty ? Number(selectedProperty.dailyPrice).toLocaleString("CLP") : "—"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setValue("billingType", "MONTHLY")}
            className={`flex-1 h-14 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-0.5 ${
              watch("billingType") === "MONTHLY"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border"
            }`}
          >
            <span className="text-xs font-medium">Mensual</span>
            <span className={`text-sm font-bold ${watch("billingType") === "MONTHLY" ? "text-primary" : "text-foreground"}`}>
              ${selectedProperty ? Number(selectedProperty.monthlyPrice).toLocaleString("CLP") : "—"}
            </span>
          </button>
        </div>
        {errors.billingType && (
          <p className="text-sm text-red-500">{errors.billingType.message}</p>
        )}
      </div>

      {selectedProperty && dateRange.from && dateRange.to && (
        <div className="rounded-lg bg-muted p-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total reserva</span>
            <span className="font-medium">{Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1} noches × {watch("unitsBooked") || 1} unidad(es)</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">Monto total</span>
            <span className="text-2xl font-bold text-primary">
              ${(
                (Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1) *
                (watch("billingType") === "DAILY" ? Number(selectedProperty.dailyPrice) : Number(selectedProperty.monthlyPrice)) *
                (watch("unitsBooked") || 1)
              ).toLocaleString("CLP")}
            </span>
          </div>
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