"use client"

import * as React from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { BUSINESS_TIME_ZONE, getDateKeyInTz } from "@/lib/domain/timezone"

interface DateRangePickerProps {
  date: { from: Date | undefined; to: Date | undefined }
  onDateChange: (date: { from: Date | undefined; to: Date | undefined }) => void
  className?: string
  blockedDates?: string[]
  mode?: "range" | "single"
  id?: string
  /**
   * Nombre del campo que se está filtrando, p. ej. "Emisión".
   *
   * Un rango de fechas no dice sobre QUÉ fecha aplica, y en una tabla con tres
   * —emisión, vencimiento y pago— eso no se adivina. Con label, el chip lee
   * "Emisión" vacío y "Emisión: 1 sept 2026 - 30 sept 2026" con rango elegido.
   * Sin label queda el texto genérico de antes, que es lo que usan los otros
   * dos callsites donde el contexto ya lo dice.
   */
  label?: string
}

export function DateRangePicker({
  date,
  onDateChange,
  className,
  blockedDates = [],
  mode = "range",
  id,
  label,
}: DateRangePickerProps) {
  // Comparación por dateKey en wall-time SCL (ADR-0020). Antes: `new Date(blocked)`
  // + `setHours(0,0,0,0)` era timezone-frágil — en zonas UTC+ un string
  // "2026-08-11" (UTC midnight) se comparaba contra local midnight del día
  // seleccionado, fallando el match aunque fueran "el mismo día calendario en SCL".
  const blockedKeys = React.useMemo(
    () => new Set(blockedDates.map((b) => b.slice(0, 10))),
    [blockedDates],
  );

  const isBlocked = (d: Date) => {
    const dayKey = getDateKeyInTz(d, BUSINESS_TIME_ZONE);
    return blockedKeys.has(dayKey);
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            data-empty={!date?.from}
            className={cn(
              "w-64 justify-start text-left font-normal truncate",
              !date?.from && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="mr-2 shrink-0" />
        {date?.from ? (
          <span className="truncate">
            {label ? `${label}: ` : ""}
            {format(date.from, "PP", { locale: es })}
            {date.to ? ` - ${format(date.to, "PP", { locale: es })}` : ""}
          </span>
        ) : (
          <span>{label ?? "Seleccionar fechas"}</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {mode === "single" ? (
          <Calendar
            mode="single"
            selected={date.from}
            onSelect={(d) => onDateChange({ from: d, to: undefined })}
            numberOfMonths={2}
            locale={es}
            disabled={(d) => isBlocked(d)}
          />
        ) : (
          <Calendar
            mode="range"
            selected={{ from: date.from, to: date.to }}
            onSelect={(range) =>
              onDateChange({ from: range?.from, to: range?.to })
            }
            numberOfMonths={2}
            locale={es}
            disabled={(d) => isBlocked(d)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}