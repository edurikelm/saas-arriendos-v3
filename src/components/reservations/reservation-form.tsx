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

import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClientForm } from "@/components/clients/client-form";
import { createClient } from "@/lib/actions/clients";
import { toast } from "sonner";
import { getBlockedDates } from "@/lib/actions/reservations";
import type { ClientInput } from "@/lib/validations/client";

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
  plan?: "FREE" | "PRO";
}

export function ReservationForm({
  properties,
  clients,
  initialData,
  onSubmit,
  onCancel,
  plan = "FREE",
}: ReservationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [clientsList, setClientsList] = React.useState(clients);
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();

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

  const [months, setMonths] = React.useState<number | undefined>(
    initialData?.months || undefined
  );

  const calculateEndDate = (start: Date, m: number): Date => {
    const end = new Date(start);
    end.setMonth(end.getMonth() + m);
    end.setDate(end.getDate() - 1);
    return end;
  };

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
      months: initialData?.months,
    },
  });

  const billingType = watch("billingType");
  const isMonthly = billingType === "MONTHLY";
  const isAtFreeLimit = plan === "FREE" && clientsList.length >= 5;

  const endDate = isMonthly && dateRange.from && months
    ? calculateEndDate(dateRange.from, months)
    : dateRange.to;

  const handleDateRangeChange = (date: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(date);
    setValue("startDate", date.from ? formatDateForInput(date.from) : "");
    setValue("endDate", date.to ? formatDateForInput(date.to) : "");
    if (isMonthly && date.from && months) {
      const end = calculateEndDate(date.from, months);
      setValue("endDate", formatDateForInput(end));
    }
  };

  const handleMonthsChange = (value: number | undefined) => {
    setMonths(value);
    setValue("months", value);
    if (dateRange.from && value) {
      const end = calculateEndDate(dateRange.from, value);
      setDateRange((prev) => ({ ...prev, to: end }));
      setValue("endDate", formatDateForInput(end));
    }
  };

  const selectedPropertyId = watch("propertyId");
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5 px-5 pt-4 pb-5">
      <input type="hidden" {...register("startDate")} />
      <input type="hidden" {...register("endDate")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-[13px] text-muted-foreground">Propiedad *</Label>
          <Combobox
            className="h-9 w-full bg-background/40"
            options={properties.map(p => ({ value: p.id, label: p.name, subtitle: `${p.unitsAvailable} disp.` }))}
            value={selectedPropertyId}
            onValueChange={(value) => setValue("propertyId", value || "")}
            placeholder="Seleccionar propiedad"
            showSearch={false}
          />
          {errors.propertyId && (
            <p className="text-sm text-red-500">{errors.propertyId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-[13px] text-muted-foreground">Cliente *</Label>
          <Combobox
            className="h-9 w-full bg-background/40"
            options={clientsList.map(c => ({ value: c.id, label: c.name, subtitle: c.email }))}
            value={watch("clientId")}
            onValueChange={(value) => setValue("clientId", value || "")}
            placeholder="Seleccionar cliente"
            searchPlaceholder="Buscar cliente por nombre o email..."
            notFoundMessage="No se encontraron clientes"
            footerAction={isAtFreeLimit ? undefined : { label: "Crear nuevo cliente...", onClick: () => setIsCreateClientOpen(true) }}
            footerDisabledMessage={isAtFreeLimit ? "Límite de 5 clientes alcanzado (plan FREE)" : undefined}
          />
          {errors.clientId && (
            <p className="text-sm text-red-500">{errors.clientId.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[13px] text-muted-foreground">Tipo de Facturación *</Label>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => {
              setValue("billingType", "DAILY");
              setMonths(undefined);
              setValue("months", undefined);
            }}
            className={`flex-1 h-[3.25rem] rounded-lg border transition-all flex flex-col items-center justify-center gap-0.5 hover:bg-muted/40 ${
              !isMonthly
                ? "border-primary/70 bg-primary/5 text-primary ring-1 ring-primary/25"
                : "border-border/80 bg-background/30"
            }`}
          >
            <span className="text-xs font-medium">Diario</span>
            <span className={`text-sm font-bold ${!isMonthly ? "text-primary" : "text-foreground"}`}>
              ${selectedProperty ? Number(selectedProperty.dailyPrice).toLocaleString("CLP") : "—"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedProperty?.monthlyPrice) return;
              setValue("billingType", "MONTHLY");
            }}
            disabled={!selectedProperty?.monthlyPrice}
            className={`flex-1 h-[3.25rem] rounded-lg border transition-all flex flex-col items-center justify-center gap-0.5 hover:bg-muted/40 ${
              isMonthly
                ? "border-primary/70 bg-primary/5 text-primary ring-1 ring-primary/25"
                : "border-border/80 bg-background/30"
            } ${!selectedProperty?.monthlyPrice ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <span className="text-xs font-medium">Mensual</span>
            <span className={`text-sm font-bold ${isMonthly ? "text-primary" : "text-foreground"}`}>
              ${selectedProperty?.monthlyPrice ? Number(selectedProperty.monthlyPrice).toLocaleString("CLP") : "—"}
            </span>
          </button>
        </div>
        {errors.billingType && (
          <p className="text-sm text-red-500">{errors.billingType.message}</p>
        )}
        {!selectedProperty?.monthlyPrice && selectedProperty && (
          <p className="text-xs text-muted-foreground">
            Esta propiedad no tiene precio mensual configurado
          </p>
        )}
      </div>

      {!isMonthly ? (
        <div className="space-y-2">
          <Label className="text-[13px] text-muted-foreground">Fechas de Estadía *</Label>
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-[13px] text-muted-foreground">Fecha de Inicio *</Label>
            <DateRangePicker
              date={{ from: dateRange.from, to: undefined }}
              onDateChange={(date) => {
                setDateRange({ from: date.from, to: undefined });
                setValue("startDate", date.from ? formatDateForInput(date.from) : "");
                if (months && date.from) {
                  const end = calculateEndDate(date.from, months);
                  setDateRange({ from: date.from, to: end });
                  setValue("endDate", formatDateForInput(end));
                } else {
                  setValue("endDate", "");
                }
              }}
              className="w-full"
              blockedDates={blockedDates}
              mode="single"
            />
            {errors.startDate && (
              <p className="text-sm text-red-500">{errors.startDate.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="months" className="text-[13px] text-muted-foreground">Cantidad de Meses *</Label>
            <Input
              id="months"
              type="number"
              min={1}
              max={12}
              {...register("months", { valueAsNumber: true })}
              value={months || ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                handleMonthsChange(val);
              }}
              className="h-9 bg-background/40"
              placeholder="Ej: 3"
            />
            {errors.months && (
              <p className="text-sm text-red-500">{errors.months.message}</p>
            )}
          </div>
        </div>
      )}

      {selectedProperty && dateRange.from && endDate && (
        <div className="rounded-lg border border-border/70 bg-background/40 p-3 space-y-1">
          {isMonthly && months ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total reserva</span>
                <span className="font-medium">{months} mes(es) × {watch("unitsBooked") || 1} unidad(es)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Período</span>
                <span className="font-medium">
                  {dateRange.from.toLocaleDateString("es-CL")} → {endDate.toLocaleDateString("es-CL")}
                </span>
              </div>
            </>
          ) : !isMonthly ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total reserva</span>
              <span className="font-medium">{Math.ceil((dateRange.to!.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1} noches × {watch("unitsBooked") || 1} unidad(es)</span>
            </div>
          ) : null}
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground">Monto total</span>
            <span className="text-xl font-semibold text-primary">
              ${(
                isMonthly && months
                  ? months * Number(selectedProperty.monthlyPrice) * (watch("unitsBooked") || 1)
                  : (Math.ceil((dateRange.to!.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1) *
                    Number(selectedProperty.dailyPrice) *
                    (watch("unitsBooked") || 1)
              ).toLocaleString("CLP")}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="unitsBooked" className="text-[13px] text-muted-foreground">Unidades Reservadas *</Label>
        <Input
          id="unitsBooked"
          type="number"
          min={1}
          max={selectedProperty?.unitsAvailable || 1}
          {...register("unitsBooked", { valueAsNumber: true })}
          className="h-9 bg-background/40"
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

      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-3 py-2">
        <Switch
          id="bookingAirbnb"
          checked={watch("bookingAirbnb")}
          onCheckedChange={(checked) => setValue("bookingAirbnb", checked)}
        />
        <Label htmlFor="bookingAirbnb" className="text-[13px]">Reserva de Airbnb</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes" className="text-[13px] text-muted-foreground">Notas</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          className="min-h-20 bg-background/40"
          placeholder="Notas para esta reserva (ej: necesita sofá cama)..."
        />
        {errors.notes && (
          <p className="text-sm text-red-500">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? "Guardando..." : "Guardar Reserva"}
        </Button>
      </div>

      <Dialog open={isCreateClientOpen} onOpenChange={setIsCreateClientOpen}>
        <DialogContent className="w-[95vw] max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <ClientForm
            serverError={serverError}
            onSubmit={async (data: ClientInput) => {
              setServerError(undefined);
              const result = await createClient(data);
              if (result.error) {
                setServerError(result.error);
                return;
              }
              const newClient = result.client!;
              toast.success("Cliente creado correctamente");
              setClientsList((prev) => [...prev, { id: newClient.id, name: newClient.name, email: newClient.email }]);
              setValue("clientId", newClient.id);
              setIsCreateClientOpen(false);
            }}
            onCancel={() => {
              setIsCreateClientOpen(false);
              setServerError(undefined);
            }}
          />
        </DialogContent>
      </Dialog>
    </form>
  );
}
