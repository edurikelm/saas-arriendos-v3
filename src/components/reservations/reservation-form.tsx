"use client";

import { useForm, useWatch } from "react-hook-form";
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
import {
  Building2,
  CalendarCheck,
  Wallet,
  Info,
  CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
    control,
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

  const billingType = useWatch({ control, name: "billingType" });
  const selectedPropertyId = useWatch({ control, name: "propertyId" });
  const clientId = useWatch({ control, name: "clientId" });
  const unitsBooked = useWatch({ control, name: "unitsBooked" });
  const bookingAirbnb = useWatch({ control, name: "bookingAirbnb" });
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
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  useEffect(() => {
    if (selectedPropertyId) {
      getBlockedDates(selectedPropertyId).then(setBlockedDates);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear availability when no property selected
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

  const nights = !isMonthly && dateRange.from && dateRange.to
    ? Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1
    : 0;

  const totalAmount = selectedProperty && dateRange.from && endDate
    ? isMonthly && months
      ? months * Number(selectedProperty.monthlyPrice) * (unitsBooked || 1)
      : nights * Number(selectedProperty.dailyPrice) * (unitsBooked || 1)
    : 0;

  const showFinancialSummary = selectedProperty && dateRange.from && endDate;

  return (
    <>
      <div className="flex flex-col max-h-[calc(90vh-65px)]">
        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6"
        >
        <input type="hidden" {...register("startDate")} />
        <input type="hidden" {...register("endDate")} />

        {/* Section 1: Detalles de la Propiedad */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Detalles de la Propiedad</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Propiedad *</Label>
              <Combobox
                className="h-9 w-full bg-card"
                options={properties.map(p => ({ value: p.id, label: p.name, subtitle: `${p.unitsAvailable} disp.` }))}
                value={selectedPropertyId}
                onValueChange={(value) => setValue("propertyId", value || "")}
                placeholder="Seleccionar propiedad"
                showSearch={false}
              />
              {errors.propertyId && (
                <p className="text-xs text-destructive mt-1">{errors.propertyId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cliente *</Label>
              <Combobox
                className="h-9 w-full bg-card"
                options={clientsList.map(c => ({ value: c.id, label: c.name, subtitle: c.email }))}
                value={clientId}
                onValueChange={(value) => setValue("clientId", value || "")}
                placeholder="Seleccionar cliente"
                searchPlaceholder="Buscar cliente por nombre o email..."
                notFoundMessage="No se encontraron clientes"
                footerAction={isAtFreeLimit ? undefined : { label: "Crear nuevo cliente...", onClick: () => setIsCreateClientOpen(true) }}
                footerDisabledMessage={isAtFreeLimit ? "Límite de 5 clientes alcanzado (plan FREE)" : undefined}
              />
              {errors.clientId && (
                <p className="text-xs text-destructive mt-1">{errors.clientId.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Configuración de Estancia */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Configuración de Estancia</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Left: Billing Type + Dates */}
            <div className="space-y-4">
              {/* Billing Type */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo de Facturación *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setValue("billingType", "DAILY");
                      setMonths(undefined);
                      setValue("months", undefined);
                    }}
                    className={`flex flex-col items-center justify-center py-2 px-3 rounded border transition-colors ${
                      !isMonthly
                        ? "border-2 border-primary bg-primary/5"
                        : "border border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <span className={`text-[9px] font-bold uppercase ${!isMonthly ? "text-primary" : "text-muted-foreground"}`}>Diario</span>
                    <span className={`text-xs font-bold ${!isMonthly ? "text-primary" : "text-foreground"}`}>
                      ${selectedProperty ? Number(selectedProperty.dailyPrice).toLocaleString("es-CL") : "—"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedProperty?.monthlyPrice) return;
                      setValue("billingType", "MONTHLY");
                    }}
                    disabled={!selectedProperty?.monthlyPrice}
                    className={`flex flex-col items-center justify-center py-2 px-3 rounded border transition-colors ${
                      isMonthly
                        ? "border-2 border-primary bg-primary/5"
                        : "border border-border bg-card hover:bg-muted/40"
                    } ${!selectedProperty?.monthlyPrice ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <span className={`text-[9px] font-bold uppercase ${isMonthly ? "text-primary" : "text-muted-foreground"}`}>Mensual</span>
                    <span className={`text-xs font-bold ${isMonthly ? "text-primary" : "text-foreground"}`}>
                      {selectedProperty?.monthlyPrice ? `$${Number(selectedProperty.monthlyPrice).toLocaleString("es-CL")}` : "—"}
                    </span>
                  </button>
                </div>
                {errors.billingType && (
                  <p className="text-xs text-destructive">{errors.billingType.message}</p>
                )}
                {!selectedProperty?.monthlyPrice && selectedProperty && (
                  <p className="text-[10px] text-muted-foreground mt-1">Esta propiedad no tiene precio mensual configurado</p>
                )}
              </div>

              {/* Dates */}
              {!isMonthly ? (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fechas de Estadía *</Label>
                  <DateRangePicker
                    date={dateRange}
                    onDateChange={handleDateRangeChange}
                    className="w-full"
                    blockedDates={blockedDates}
                  />
                  {(errors.startDate || errors.endDate) && (
                    <p className="text-xs text-destructive">
                      {errors.startDate?.message || errors.endDate?.message}
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fecha de Inicio *</Label>
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
                      <p className="text-xs text-destructive mt-1">{errors.startDate.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Meses *</Label>
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
                      className="h-9 bg-card"
                      placeholder="Ej: 3"
                    />
                    {errors.months && (
                      <p className="text-xs text-destructive mt-1">{errors.months.message}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Units + Airbnb */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unidades *</Label>
                <Input
                  id="unitsBooked"
                  type="number"
                  min={1}
                  max={selectedProperty?.unitsAvailable || 1}
                  {...register("unitsBooked", { valueAsNumber: true })}
                  className="h-9 bg-card"
                />
                {errors.unitsBooked && (
                  <p className="text-xs text-destructive mt-1">{errors.unitsBooked.message}</p>
                )}
                {selectedProperty && (
                  <p className="text-[10px] text-muted-foreground">Disponibles: {selectedProperty.unitsAvailable}</p>
                )}
              </div>

              {/* Airbnb Toggle */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded border border-border">
                <Switch
                  id="bookingAirbnb"
                  checked={bookingAirbnb}
                  onCheckedChange={(checked) => setValue("bookingAirbnb", checked)}
                />
                <Label htmlFor="bookingAirbnb" className="text-xs font-medium text-foreground cursor-pointer">Reserva de Airbnb</Label>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Resumen Financiero */}
        {showFinancialSummary && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-border">
              <Wallet className="h-4 w-4 text-primary" />
              <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Resumen Financiero</h3>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Detalle */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      <p className="text-[10px] uppercase font-bold tracking-wider">Detalle</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground pl-6">
                      {isMonthly
                        ? `${months} ${months === 1 ? "mes" : "meses"} × ${unitsBooked || 1} ${(unitsBooked || 1) === 1 ? "unidad" : "unidades"}`
                        : `${nights} ${nights === 1 ? "noche" : "noches"} × ${unitsBooked || 1} ${(unitsBooked || 1) === 1 ? "unidad" : "unidades"}`}
                    </p>
                  </div>

                  {/* Período */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <p className="text-[10px] uppercase font-bold tracking-wider">Período</p>
                    </div>
                    <div className="pl-6 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase">Desde</span>
                        <span className="text-sm font-semibold text-foreground">
                          {format(dateRange.from!, "d MMM, yyyy", { locale: es })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-medium uppercase">Hasta</span>
                        <span className="text-sm font-semibold text-foreground">
                          {format(endDate!, "d MMM, yyyy", { locale: es })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monto Total */}
                <div className="shrink-0 flex flex-col items-start md:items-end justify-center pt-4 md:pt-0 md:pl-6 md:border-l border-primary/10">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Monto Total</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-primary tabular-nums">${totalAmount.toLocaleString("es-CL")}</span>
                    <span className="text-[10px] font-medium text-primary/60 uppercase">CLP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Notas adicionales */}
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notas adicionales</Label>
          <Textarea
            id="notes"
            {...register("notes")}
            className="min-h-20 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring resize-none transition-all"
            placeholder="Notas para esta reserva..."
          />
          {errors.notes && (
            <p className="text-xs text-destructive mt-1">{errors.notes.message}</p>
          )}
        </div>
      </form>

      {/* Footer - outside the form */}
      <div className="shrink-0 border-t border-border bg-muted/30 px-5 py-5 flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="h-10 px-6 text-sm font-medium">
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={handleSubmit(handleFormSubmit)}
          disabled={isSubmitting}
          className="h-10 px-8 text-sm font-medium"
        >
          {isSubmitting ? "Guardando..." : "Guardar Reserva"}
        </Button>
      </div>
    </div>

    {/* Sub-Dialog: Nuevo Cliente */}
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
    </>
  );
}
