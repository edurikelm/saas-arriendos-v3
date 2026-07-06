"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";

interface Property {
  id: string;
  name: string;
}

interface PaymentsFiltersProps {
  properties: Property[];
  propertyId: string;
  method: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

export function PaymentsFilters({
  properties,
  propertyId: initialPropertyId,
  method: initialMethod,
  status: initialStatus,
  dateFrom: initialDateFrom,
  dateTo: initialDateTo,
}: PaymentsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [method, setMethod] = useState(initialMethod);
  const [status, setStatus] = useState(initialStatus);
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

  function handleClear() {
    setPropertyId("");
    setMethod("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    router.push("/payments");
  }

  function handleDateChange(range: { from: Date | undefined; to: Date | undefined }) {
    setDateFrom(range?.from ? range.from.toISOString().split("T")[0] : "");
    setDateTo(range?.to ? range.to.toISOString().split("T")[0] : "");
  }

  const hasFilters = propertyId || method || status || dateFrom || dateTo;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 min-w-0">
        <Select value={propertyId || "__all__"} onValueChange={handlePropertyChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todas las propiedades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las propiedades</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-40">
        <Select value={method || "__all__"} onValueChange={handleMethodChange}>
          <SelectTrigger>
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los métodos</SelectItem>
            <SelectItem value="MERCADO_PAGO">Mercado Pago</SelectItem>
            <SelectItem value="CASH">Efectivo</SelectItem>
            <SelectItem value="TRANSFER">Transferencia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-40">
        <Select value={status || "__all__"} onValueChange={handleStatusChange}>
          <SelectTrigger>
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los estados</SelectItem>
            <SelectItem value="PENDING">Pendiente</SelectItem>
            <SelectItem value="COMPLETED">Completado</SelectItem>
            <SelectItem value="FAILED">Fallido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DateRangePicker
        date={{
          from: dateFrom ? new Date(dateFrom) : undefined,
          to: dateTo ? new Date(dateTo) : undefined,
        }}
        onDateChange={handleDateChange}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear}>
          Limpiar
        </Button>
      )}
    </div>
  );
}
