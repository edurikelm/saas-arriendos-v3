"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { FilterChip } from "@/components/ui/filter-chip";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { localDateKey } from "@/lib/domain/timezone";
import { Search, X } from "lucide-react";

interface Property {
  id: string;
  name: string;
}

interface PaymentsFiltersProps {
  properties: Property[];
  propertyId: string;
  method: string;
  status: string;
  paymentType: string;
  search: string;
  dateFrom: string;
  dateTo: string;
}

const METHOD_LABELS: Record<string, string> = {
  MERCADO_PAGO: "Mercado Pago",
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  COMPLETED: "Completado",
  FAILED: "Fallido",
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  RESERVATION: "Arriendo",
  EXTRA: "Extra",
};

export function PaymentsFilters({
  properties,
  propertyId: initialPropertyId,
  method: initialMethod,
  status: initialStatus,
  paymentType: initialPaymentType,
  search: initialSearch,
  dateFrom: initialDateFrom,
  dateTo: initialDateTo,
}: PaymentsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [method, setMethod] = useState(initialMethod);
  const [status, setStatus] = useState(initialStatus);
  const [paymentType, setPaymentType] = useState(initialPaymentType);
  const [search, setSearch] = useState(initialSearch);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);

  const updateUrl = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      params.delete("page"); // reset to page 1 on filter change
      router.push(`/payments?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Debounce de la búsqueda.
  //
  // El guard compara contra lo que ya está en la URL en vez de saltarse el
  // primer render. Así no navega al montar, y BORRAR el campo sí navega: un
  // `if (search)` como el de las fechas de abajo dejaría el filtro pegado en la
  // URL y el listado filtrado con el input vacío.
  useEffect(() => {
    if (search === initialSearch) return;
    const timer = setTimeout(() => updateUrl({ search }), 400);
    return () => clearTimeout(timer);
  }, [search, initialSearch, updateUrl]);

  // Debounce date range changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (dateFrom || dateTo) {
        updateUrl({ dateFrom, dateTo });
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  function handlePropertyChange(value: string | null) {
    const v = value ?? "";
    setPropertyId(v);
    updateUrl({ propertyId: v });
  }

  function handleMethodChange(value: string | null) {
    const v = value ?? "";
    setMethod(v);
    updateUrl({ method: v });
  }

  function handleStatusChange(value: string | null) {
    const v = value ?? "";
    setStatus(v);
    updateUrl({ status: v });
  }

  function handlePaymentTypeChange(value: string | null) {
    const v = value ?? "";
    setPaymentType(v);
    updateUrl({ paymentType: v });
  }

  function handleClear() {
    setPropertyId("");
    setMethod("");
    setStatus("");
    setPaymentType("");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    router.push("/payments");
  }

  function handleDateChange(range: { from: Date | undefined; to: Date | undefined }) {
    // Valores del date-picker (medianoche LOCAL del navegador): usar
    // localDateKey, no slice UTC — ver src/lib/domain/timezone.ts.
    setDateFrom(range?.from ? localDateKey(range.from) : "");
    setDateTo(range?.to ? localDateKey(range.to) : "");
  }

  const hasFilters = propertyId || method || status || paymentType || search || dateFrom || dateTo;
  const hasDateRange = dateFrom || dateTo;

  // Valor legible del filtro activo, o `undefined` si está apagado. El chip
  // muestra SIEMPRE el nombre de la dimensión y le suma el valor al lado; antes
  // el valor reemplazaba al nombre, así que un chip activo dejaba de decir qué
  // filtraba — el mismo problema que tenía el de fechas.
  const propertyValueLabel = propertyId
    ? properties.find((p) => p.id === propertyId)?.name
    : undefined;
  const methodValueLabel = method ? METHOD_LABELS[method] ?? method : undefined;
  const statusValueLabel = status ? STATUS_LABELS[status] ?? status : undefined;
  const paymentTypeValueLabel = paymentType
    ? PAYMENT_TYPE_LABELS[paymentType] ?? paymentType
    : undefined;

  return (
    <div className="space-y-4">
      {/* Buscador. Un solo campo sobre cliente, propiedad, concepto y monto —
          hasta acá la única forma de encontrar un cobro puntual era filtrar y
          paginar. Mismo patrón y mismo debounce que /reservations. */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          aria-label="Buscar pagos"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente, propiedad, concepto o monto..."
          className="h-10 w-full rounded-lg border border-border bg-card pl-12 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/60"
        />
      </div>

      {/* Filter Chips Row */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label="Propiedad"
          value={propertyId}
          valueLabel={propertyValueLabel}
          valueMaxWidth="max-w-[140px]"
          onClear={() => handlePropertyChange("")}
        >
          <DropdownMenuContent className="ring-1 ring-foreground/10">
            <DropdownMenuItem
              onClick={() => handlePropertyChange("")}
              className={!propertyId ? "bg-accent" : ""}
            >
              Todas las propiedades
            </DropdownMenuItem>
            {properties.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => handlePropertyChange(p.id)}
                className={propertyId === p.id ? "bg-accent" : ""}
              >
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </FilterChip>

        <FilterChip
          label="Método"
          value={method}
          valueLabel={methodValueLabel}
          onClear={() => handleMethodChange("")}
        >
          <DropdownMenuContent className="ring-1 ring-foreground/10">
            <DropdownMenuItem
              onClick={() => handleMethodChange("")}
              className={!method ? "bg-accent" : ""}
            >
              Todos los métodos
            </DropdownMenuItem>
            {Object.entries(METHOD_LABELS).map(([value, label]) => (
              <DropdownMenuItem
                key={value}
                onClick={() => handleMethodChange(value)}
                className={method === value ? "bg-accent" : ""}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </FilterChip>

        <FilterChip
          label="Estado"
          value={status}
          valueLabel={statusValueLabel}
          onClear={() => handleStatusChange("")}
        >
          <DropdownMenuContent className="ring-1 ring-foreground/10">
            <DropdownMenuItem
              onClick={() => handleStatusChange("")}
              className={!status ? "bg-accent" : ""}
            >
              Todos los estados
            </DropdownMenuItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <DropdownMenuItem
                key={value}
                onClick={() => handleStatusChange(value)}
                className={status === value ? "bg-accent" : ""}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </FilterChip>

        <FilterChip
          label="Tipo"
          value={paymentType}
          valueLabel={paymentTypeValueLabel}
          onClear={() => handlePaymentTypeChange("")}
        >
          <DropdownMenuContent className="ring-1 ring-foreground/10">
            <DropdownMenuItem
              onClick={() => handlePaymentTypeChange("")}
              className={!paymentType ? "bg-accent" : ""}
            >
              Todos
            </DropdownMenuItem>
            {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
              <DropdownMenuItem
                key={value}
                onClick={() => handlePaymentTypeChange(value)}
                className={paymentType === value ? "bg-accent" : ""}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </FilterChip>

        {/* DateRangePicker como chip */}
        <DateRangePicker
          label="Emisión"
          className={`flex items-center gap-2 px-3 py-1.5 border rounded text-xs font-medium transition-colors ${
            hasDateRange
              ? "bg-primary/10 border-primary/20 text-primary"
              : "bg-card border-border text-foreground hover:border-primary"
          }`}
          date={{
            from: dateFrom ? new Date(dateFrom) : undefined,
            to: dateTo ? new Date(dateTo) : undefined,
          }}
          onDateChange={handleDateChange}
        />

        {/* Separator + Limpiar filtros */}
        {hasFilters && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-8 px-3 text-xs font-bold text-muted-foreground hover:text-destructive-text transition-colors"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Limpiar filtros
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
