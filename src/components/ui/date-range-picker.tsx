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

interface DateRangePickerProps {
  date: { from: Date | undefined; to: Date | undefined }
  onDateChange: (date: { from: Date | undefined; to: Date | undefined }) => void
  className?: string
}

export function DateRangePicker({
  date,
  onDateChange,
  className,
}: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
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
          date.to ? (
            <span className="truncate">
              {format(date.from, "PP", { locale: es })} - {format(date.to, "PP", { locale: es })}
            </span>
          ) : (
            format(date.from, "PP", { locale: es })
          )
        ) : (
          <span>Seleccionar fechas</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={{ from: date.from, to: date.to }}
          onSelect={(range) =>
            onDateChange({ from: range?.from, to: range?.to })
          }
          numberOfMonths={2}
          locale={es}
          disabled={(date) =>
            date > new Date() || date < new Date("1900-01-01")
          }
        />
      </PopoverContent>
    </Popover>
  )
}
