"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ChevronDown, X } from "lucide-react";

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
  dateFrom: initialDateFrom,
  dateTo: initialDateTo,
}: PaymentsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [method, setMethod] = useState(initialMethod);
  const [status, setStatus] = useState(initialStatus);
  const [paymentType, setPaymentType] = useState(initialPaymentType);
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
    setDateFrom("");
    setDateTo("");
    router.push("/payments");
  }

  function handleDateChange(range: { from: Date | undefined; to: Date | undefined }) {
    setDateFrom(range?.from ? range.from.toISOString().split("T")[0] : "");
    setDateTo(range?.to ? range.to.toISOString().split("T")[0] : "");
  }

  const hasFilters = propertyId || method || status || paymentType || dateFrom || dateTo;
  const hasDateRange = dateFrom || dateTo;

  // Chip labels
  const propertyLabel = propertyId
    ? properties.find((p) => p.id === propertyId)?.name ?? "Propiedad"
    : "Propiedad";
  const methodLabel = method ? METHOD_LABELS[method] ?? method : "Método";
  const statusLabel = status ? STATUS_LABELS[status] ?? status : "Estado";
  const paymentTypeLabel = paymentType
    ? PAYMENT_TYPE_LABELS[paymentType] ?? paymentType
    : "Tipo";

  return (
    <div className="space-y-4">
      {/* Filter Chips Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Propiedad */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`flex items-center gap-2 px-3 py-1.5 border rounded text-xs font-medium transition-colors ${
              propertyId
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-card border-border text-foreground hover:border-primary"
            }`}
          >
            {propertyLabel}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
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
        </DropdownMenu>

        {/* Método */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`flex items-center gap-2 px-3 py-1.5 border rounded text-xs font-medium transition-colors ${
              method
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-card border-border text-foreground hover:border-primary"
            }`}
          >
            {methodLabel}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="ring-1 ring-foreground/10">
            <DropdownMenuItem
              onClick={() => handleMethodChange("")}
              className={!method ? "bg-accent" : ""}
            >
              Todos los métodos
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleMethodChange("MERCADO_PAGO")}
              className={method === "MERCADO_PAGO" ? "bg-accent" : ""}
            >
              Mercado Pago
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleMethodChange("CASH")}
              className={method === "CASH" ? "bg-accent" : ""}
            >
              Efectivo
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleMethodChange("TRANSFER")}
              className={method === "TRANSFER" ? "bg-accent" : ""}
            >
              Transferencia
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Estado */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`flex items-center gap-2 px-3 py-1.5 border rounded text-xs font-medium transition-colors ${
              status
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-card border-border text-foreground hover:border-primary"
            }`}
          >
            {statusLabel}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="ring-1 ring-foreground/10">
            <DropdownMenuItem
              onClick={() => handleStatusChange("")}
              className={!status ? "bg-accent" : ""}
            >
              Todos los estados
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleStatusChange("PENDING")}
              className={status === "PENDING" ? "bg-accent" : ""}
            >
              Pendiente
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleStatusChange("COMPLETED")}
              className={status === "COMPLETED" ? "bg-accent" : ""}
            >
              Completado
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleStatusChange("FAILED")}
              className={status === "FAILED" ? "bg-accent" : ""}
            >
              Fallido
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tipo */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`flex items-center gap-2 px-3 py-1.5 border rounded text-xs font-medium transition-colors ${
              paymentType
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-card border-border text-foreground hover:border-primary"
            }`}
          >
            {paymentTypeLabel}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="ring-1 ring-foreground/10">
            <DropdownMenuItem
              onClick={() => handlePaymentTypeChange("")}
              className={!paymentType ? "bg-accent" : ""}
            >
              Todos
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handlePaymentTypeChange("RESERVATION")}
              className={paymentType === "RESERVATION" ? "bg-accent" : ""}
            >
              Arriendo
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handlePaymentTypeChange("EXTRA")}
              className={paymentType === "EXTRA" ? "bg-accent" : ""}
            >
              Extra
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* DateRangePicker como chip */}
        <DateRangePicker
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
              className="h-8 px-3 text-xs font-bold text-muted-foreground hover:text-destructive transition-colors"
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
