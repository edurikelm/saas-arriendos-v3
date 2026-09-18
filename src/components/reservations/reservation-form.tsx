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
import { getActiveBrokers } from "@/lib/actions/brokers";
import { getNights } from "@/components/reservations/reservation-status";
import { dateOnlyKey, localDateKey } from "@/lib/domain/timezone";
import type { ClientInput } from "@/lib/validations/client";
import {
  Building2,
  CalendarCheck,
  Handshake,
} from "lucide-react";

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
  // El formulario se trae sus propios captadores activos, como ya hace con las
  // fechas bloqueadas. Evita pasar la lista por las tres superficies que lo
  // montan (lista, calendario y detalle).
  const [brokers, setBrokers] = useState<
    { id: string; name: string; defaultCommissionRate: number }[]
  >([]);

  // Dos formas de fecha entran a este formulario y necesitan tratamientos
  // opuestos (ver `src/lib/domain/timezone.ts`): `initialData` viene de la
  // base (date-only, anclado a 15:00/16:00 UTC) y usa `dateOnlyKey`; los
  // valores del date-picker (`react-day-picker` entrega medianoche LOCAL del
  // navegador) usan `localDateKey`. Fusionarlas en una sola función fue el
  // bug de raíz: un slice UTC único se equivoca un día para una de las dos
  // formas en cualquier offset positivo. No las vuelvas a fusionar.
  const formatBaseDateForInput = (date: Date | string | undefined): string => {
    if (!date) return "";
    return dateOnlyKey(date);
  };

  const formatPickerDateForInput = (date: Date | undefined): string => {
    if (!date) return "";
    return localDateKey(date);
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
      startDate: formatBaseDateForInput(initialData?.startDate),
      endDate: formatBaseDateForInput(initialData?.endDate),
      billingType: initialData?.billingType || "DAILY",
      unitsBooked: initialData?.unitsBooked || 1,
      bookingAirbnb: initialData?.bookingAirbnb || false,
      notes: initialData?.notes || "",
      months: initialData?.months,
      brokerId: initialData?.brokerId || "",
      commissionRate: initialData?.commissionRate ?? undefined,
    },
  });

  const billingType = useWatch({ control, name: "billingType" });
  const selectedPropertyId = useWatch({ control, name: "propertyId" });
  const clientId = useWatch({ control, name: "clientId" });
  const unitsBooked = useWatch({ control, name: "unitsBooked" });
  const bookingAirbnb = useWatch({ control, name: "bookingAirbnb" });
  const brokerId = useWatch({ control, name: "brokerId" });
  const commissionRate = useWatch({ control, name: "commissionRate" });
  const isMonthly = billingType === "MONTHLY";
  const isAtFreeLimit = plan === "FREE" && clientsList.length >= 5;

  const endDate = isMonthly && dateRange.from && months
    ? calculateEndDate(dateRange.from, months)
    : dateRange.to;

  const handleDateRangeChange = (date: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(date);
    setValue("startDate", date.from ? formatPickerDateForInput(date.from) : "");
    setValue("endDate", date.to ? formatPickerDateForInput(date.to) : "");
    if (isMonthly && date.from && months) {
      const end = calculateEndDate(date.from, months);
      setValue("endDate", formatPickerDateForInput(end));
    }
  };

  const handleMonthsChange = (value: number | undefined) => {
    setMonths(value);
    setValue("months", value);
    if (dateRange.from && value) {
      const end = calculateEndDate(dateRange.from, value);
      setDateRange((prev) => ({ ...prev, to: end }));
      setValue("endDate", formatPickerDateForInput(end));
    }
  };
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  useEffect(() => {
    getActiveBrokers().then(setBrokers);
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      getBlockedDates(selectedPropertyId).then(setBlockedDates);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear availability when no property selected
      setBlockedDates([]);
    }
  }, [selectedPropertyId]);

  // Elegir captador precarga SU porcentaje por defecto, y el propietario puede
  // pisarlo para esta reserva. Desde el guardado, la tasa es un dato de la
  // reserva y no vuelve a leerse del captador (ADR-0040 §2).
  const handleBrokerChange = (value: string | undefined) => {
    const nextId = value || "";
    setValue("brokerId", nextId);

    if (!nextId) {
      setValue("commissionRate", undefined);
      return;
    }

    const broker = brokers.find((b) => b.id === nextId);
    if (broker) setValue("commissionRate", broker.defaultCommissionRate);
  };

  const handleFormSubmit = async (data: ReservationFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data as unknown as ReservationInput);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nights = !isMonthly && dateRange.from && dateRange.to
    ? getNights(dateRange.from, dateRange.to)
    : 0;

  const totalAmount = selectedProperty && dateRange.from && endDate
    ? isMonthly && months
      ? months * Number(selectedProperty.monthlyPrice) * (unitsBooked || 1)
      : nights * Number(selectedProperty.dailyPrice) * (unitsBooked || 1)
    : 0;

  const showFinancialSummary = selectedProperty && dateRange.from && endDate;

  // Comisión proyectada del arriendo completo. Es la misma cuenta que hace el
  // seam (`commissionForPayment`), pero sobre el total en vez de sobre un pago:
  // acá todavía no hay pagos, y el owner necesita ver lo que le queda ANTES de
  // guardar, que es cuando todavía puede negociar el porcentaje.
  const selectedBroker = brokers.find((b) => b.id === brokerId);
  const effectiveRate =
    brokerId && typeof commissionRate === "number" && Number.isFinite(commissionRate)
      ? commissionRate
      : null;
  const projectedCommission =
    effectiveRate === null ? 0 : Math.round((totalAmount * effectiveRate) / 100);
  const netAmount = totalAmount - projectedCommission;

  // Unidad de la estadía para la barra de resumen. Corta en móvil ("8 noches")
  // y con las unidades en pantallas anchas ("8 noches × 2 unidades").
  const stayCount = isMonthly ? months ?? 0 : nights;
  const stayUnit = isMonthly
    ? stayCount === 1 ? "mes" : "meses"
    : stayCount === 1 ? "noche" : "noches";
  const units = unitsBooked || 1;
  const stayShort = `${stayCount} ${stayUnit}`;
  const stayLong = `${stayShort} × ${units} ${units === 1 ? "unidad" : "unidades"}`;
  const formatRate = (rate: number) =>
    `${rate.toLocaleString("es-CL", { maximumFractionDigits: 2 })}%`;

  return (
    <>
      <div className="flex flex-col max-h-[calc(90vh-65px)]">
        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6"
        >
        {/* Resumen en una línea, primero y fijo arriba del scroll.
            Es la lectura en vivo del formulario: cambia con cada campo, así que
            va donde se ve mientras se llena, no al final. Fijo porque en móvil
            el formulario scrollea y el total es lo que se vuelve a mirar.
            Sangra hasta el borde (-mx/-mt) para que el contenido que pasa por
            debajo no asome por los costados. Fondo `--summary`: verdigris
            lavado y opaco, para que se lea como el resultado del formulario y
            no como una segunda línea del encabezado. Sin sombra (DESIGN.md:
            plano por defecto); la separación es un borde del mismo matiz.
            `top` negativo y no `top-0`: el borde de pegado de un sticky es el
            del padding del contenedor que scrollea, no el del scrollport. Con
            `top-0` quedaba 16px abajo y las filas asomaban por encima al
            scrollear. Medido en móvil. */}
        <div
          data-testid="reservation-summary"
          className="sticky -top-4 sm:-top-6 z-10 -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 flex min-h-11 items-center gap-3 border-b border-summary-border bg-summary px-4 py-2.5 sm:px-6"
        >
          {showFinancialSummary ? (
            <>
              <span className="min-w-0 truncate text-xs text-summary-muted-foreground tabular-nums">
                <span className="sm:hidden">{stayShort}</span>
                <span className="hidden sm:inline">{stayLong}</span>
              </span>

              {/* Se lee como una cuenta, de izquierda a derecha: total, menos
                  el captador, igual al neto. Cada tramo es rótulo + cifra con
                  el mismo peso; solo el resultado sube de tamaño y toma el
                  verde, que es el rol de Verdigris (resultado primario). */}
              <div className="ml-auto flex min-w-0 shrink-0 items-baseline gap-3 text-xs text-summary-muted-foreground tabular-nums">
                {effectiveRate !== null ? (
                  <>
                    {/* Los {" "} entre tramos no se ven (en flex, el espacio
                        suelto no ocupa lugar; lo separa el gap) pero evitan que
                        un lector de pantalla lea "$400.000Ana Rojas". */}
                    <span>
                      <span className="sr-only sm:not-sr-only">Total </span>
                      ${totalAmount.toLocaleString("es-CL")}
                    </span>{" "}
                    {/* La comisión cede en móvil: el neto ya la implica, y la
                        línea no alcanza para las cuatro cifras. Queda para
                        lectores de pantalla en todos los anchos. */}
                    <span className="sr-only sm:not-sr-only sm:inline-flex sm:items-baseline sm:gap-1">
                      {/* Solo el nombre se trunca: con la tasa adentro del
                          mismo span, un nombre largo se comía el porcentaje. */}
                      <span
                        className="max-w-32 truncate"
                        title={selectedBroker?.name ?? "Captador"}
                      >
                        {selectedBroker?.name ?? "Captador"}
                      </span>{" "}
                      <span>{formatRate(effectiveRate)}</span>{" "}
                      <span>−${projectedCommission.toLocaleString("es-CL")}</span>
                    </span>{" "}
                    <span className="text-sm font-bold text-primary-text">
                      Neto ${netAmount.toLocaleString("es-CL")}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-primary-text">
                    Total ${totalAmount.toLocaleString("es-CL")}
                  </span>
                )}
              </div>
            </>
          ) : (
            <span className="text-xs text-summary-muted-foreground">
              Elige propiedad y fechas para calcular el total
            </span>
          )}
        </div>

        <input type="hidden" {...register("startDate")} />
        <input type="hidden" {...register("endDate")} />

        {/* Section 1: Reserva — qué propiedad y para quién */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Reserva</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="propertyId" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Propiedad *</Label>
              <Combobox
                id="propertyId"
                className="h-9 w-full bg-card"
                options={properties.map(p => ({ value: p.id, label: p.name, subtitle: `${p.unitsAvailable} disp.` }))}
                value={selectedPropertyId}
                onValueChange={(value) => setValue("propertyId", value || "")}
                placeholder="Seleccionar propiedad"
                showSearch={false}
                aria-invalid={!!errors.propertyId}
                aria-describedby={errors.propertyId ? "propertyId-error" : undefined}
              />
              {errors.propertyId && (
                <p id="propertyId-error" className="text-xs text-destructive-text mt-1">{errors.propertyId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="clientId" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cliente *</Label>
              <Combobox
                id="clientId"
                className="h-9 w-full bg-card"
                options={clientsList.map(c => ({ value: c.id, label: c.name, subtitle: c.email }))}
                value={clientId}
                onValueChange={(value) => setValue("clientId", value || "")}
                placeholder="Seleccionar cliente"
                searchPlaceholder="Buscar cliente por nombre o email..."
                notFoundMessage="No se encontraron clientes"
                footerAction={isAtFreeLimit ? undefined : { label: "Crear nuevo cliente...", onClick: () => setIsCreateClientOpen(true) }}
                footerDisabledMessage={isAtFreeLimit ? "Límite de 5 clientes alcanzado (plan FREE)" : undefined}
                aria-invalid={!!errors.clientId}
                aria-describedby={errors.clientId ? "clientId-error" : undefined}
              />
              {errors.clientId && (
                <p id="clientId-error" className="text-xs text-destructive-text mt-1">{errors.clientId.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Estadía */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border">
            <CalendarCheck className="h-4 w-4 text-primary" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Estadía</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Left: Billing Type + Dates */}
            <div className="space-y-4">
              {/* Billing Type */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo de Facturación *</Label>
                <div role="radiogroup" aria-label="Tipo de facturación" className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!isMonthly}
                    tabIndex={!isMonthly ? 0 : -1}
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
                    role="radio"
                    aria-checked={isMonthly}
                    tabIndex={isMonthly ? 0 : -1}
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
                  <p className="text-xs text-destructive-text">{errors.billingType.message}</p>
                )}
                {!selectedProperty?.monthlyPrice && selectedProperty && (
                  <p className="text-[10px] text-muted-foreground mt-1">Esta propiedad no tiene precio mensual configurado</p>
                )}
              </div>

              {/* Dates */}
              {!isMonthly ? (
                <div className="space-y-1.5">
                  <Label htmlFor="startDate" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fechas de Estadía *</Label>
                  <DateRangePicker
                    id="startDate"
                    date={dateRange}
                    onDateChange={handleDateRangeChange}
                    className="w-full"
                    blockedDates={blockedDates}
                  />
                  {(errors.startDate || errors.endDate) && (
                    <p id="startDate-error" className="text-xs text-destructive-text">
                      {errors.startDate?.message || errors.endDate?.message}
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="startDate" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fecha de Inicio *</Label>
                    <DateRangePicker
                      date={{ from: dateRange.from, to: undefined }}
                      onDateChange={(date) => {
                        setDateRange({ from: date.from, to: undefined });
                        setValue("startDate", date.from ? formatPickerDateForInput(date.from) : "");
                        if (months && date.from) {
                          const end = calculateEndDate(date.from, months);
                          setDateRange({ from: date.from, to: end });
                          setValue("endDate", formatPickerDateForInput(end));
                        } else {
                          setValue("endDate", "");
                        }
                      }}
                      className="w-full"
                      blockedDates={blockedDates}
                      mode="single"
                    />
                    {errors.startDate && (
                      <p className="text-xs text-destructive-text mt-1">{errors.startDate.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="months" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Meses *</Label>
                    <Input
                      id="months"
                      type="number"
                      min={1}
                      max={12}
                      aria-invalid={!!errors.months}
                      aria-describedby={errors.months ? "months-error" : undefined}
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
                      <p id="months-error" className="text-xs text-destructive-text mt-1">{errors.months.message}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Units + Airbnb */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="unitsBooked" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unidades *</Label>
                <Input
                  id="unitsBooked"
                  type="number"
                  min={1}
                  max={selectedProperty?.unitsAvailable || 1}
                  aria-invalid={!!errors.unitsBooked}
                  aria-describedby={errors.unitsBooked ? "unitsBooked-error" : undefined}
                  {...register("unitsBooked", { valueAsNumber: true })}
                  className="h-9 bg-card"
                />
                {errors.unitsBooked && (
                  <p id="unitsBooked-error" className="text-xs text-destructive-text mt-1">{errors.unitsBooked.message}</p>
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

        {/* Section 3: Captación */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border">
            <Handshake className="h-4 w-4 text-primary" />
            <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Captación</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="brokerId" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Captador</Label>
              <Combobox
                id="brokerId"
                className="h-9 w-full bg-card"
                options={[
                  { value: "", label: "Sin captador", subtitle: "La conseguí yo" },
                  ...brokers.map((b) => ({
                    value: b.id,
                    label: b.name,
                    subtitle: `${b.defaultCommissionRate.toLocaleString("es-CL", { maximumFractionDigits: 2 })}% por defecto`,
                  })),
                ]}
                value={brokerId || ""}
                onValueChange={handleBrokerChange}
                placeholder="Sin captador"
                searchPlaceholder="Buscar captador..."
                notFoundMessage="No hay captadores activos"
                aria-invalid={!!errors.brokerId}
              />
              {errors.brokerId && (
                <p className="text-xs text-destructive-text mt-1">{errors.brokerId.message}</p>
              )}
            </div>

            {brokerId ? (
              <div className="space-y-1.5">
                <Label htmlFor="commissionRate" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Comisión (%) *</Label>
                <Input
                  id="commissionRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="h-9 bg-card"
                  aria-invalid={!!errors.commissionRate}
                  aria-describedby={errors.commissionRate ? "commissionRate-error" : undefined}
                  {...register("commissionRate", { valueAsNumber: true })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Queda fijo en esta reserva: cambiar el porcentaje del captador
                  después no la mueve.
                </p>
                {errors.commissionRate && (
                  <p id="commissionRate-error" className="text-xs text-destructive-text mt-1">{errors.commissionRate.message}</p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Section 4: Notas adicionales */}
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notas adicionales</Label>
          <Textarea
            id="notes"
            aria-invalid={!!errors.notes}
            aria-describedby={errors.notes ? "notes-error" : undefined}
            {...register("notes")}
            className="min-h-20 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:border-ring resize-none transition-all"
            placeholder="Notas para esta reserva..."
          />
          {errors.notes && (
            <p id="notes-error" className="text-xs text-destructive-text mt-1">{errors.notes.message}</p>
          )}
        </div>
      </form>

      {/* Footer - outside the form */}
      <div className="shrink-0 border-t border-border bg-muted/30 px-4 sm:px-5 py-4 sm:py-5 flex items-center justify-end gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
