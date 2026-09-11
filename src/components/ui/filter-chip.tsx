"use client";

import * as React from "react";
import { ChevronDown, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Chip de filtro con desplegable: un disparador que dice QUÉ se filtra y con
 * qué valor, más un botón de limpiar al lado.
 *
 * Es el hermano de `FilterPill`, no su reemplazo. `FilterPill` es un control
 * segmentado que dibuja TODAS las opciones inline: sirve para dos o tres
 * valores fijos. Este es para dimensiones de N valores —propiedades, clientes—
 * donde las opciones tienen que vivir en un menú.
 *
 * Vivía dentro de `reservations-list-client.tsx`. Se extrajo cuando
 * `/payments` necesitó lo mismo y lo había reimplementado distinto: markup a
 * mano, sin `buttonVariants`, sin botón de limpiar, y reemplazando la etiqueta
 * por el valor —así que el chip dejaba de decir qué dimensión filtraba, que es
 * el mismo problema que tenía el de fechas.
 *
 * **El botón de limpiar va como HERMANO del disparador, no adentro.** Anidar un
 * `button` dentro del `DropdownMenuTrigger` produce HTML inválido y deja la
 * acción de limpiar inalcanzable por teclado.
 */
export interface FilterChipProps {
  /** Nombre de la dimensión, p. ej. "Propiedad". Siempre visible. */
  label: string;
  /** Valor activo, o vacío/null si el filtro está apagado. */
  value: string | null;
  /** Texto legible del valor activo, p. ej. el nombre de la propiedad. */
  valueLabel?: string;
  /** Tope de ancho del valor, para que un nombre largo no estire la fila. */
  valueMaxWidth?: string;
  onClear: () => void;
  /** Default: "Quitar filtro de {label en minúscula}". */
  clearAriaLabel?: string;
  /** El `<DropdownMenuContent>` con las opciones. */
  children: React.ReactNode;
}

export function FilterChip({
  label,
  value,
  valueLabel,
  valueMaxWidth,
  onClear,
  clearAriaLabel,
  children,
}: FilterChipProps) {
  const isActive = Boolean(value);

  return (
    <div className="inline-flex items-center gap-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-7 gap-1.5 px-2.5 text-xs font-medium",
            // El estado activo es el mismo en todos los callsites, así que vive
            // acá y no como prop: repetido en cada uno, era una cadena que solo
            // podía divergir.
            isActive &&
              "border-primary/20 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
          )}
        >
          <span>{label}</span>
          {isActive && valueLabel && (
            <>
              <span className="text-muted-foreground/60">·</span>
              <span className={cn("truncate font-bold", valueMaxWidth)}>{valueLabel}</span>
            </>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        {children}
      </DropdownMenu>
      {isActive && (
        <button
          type="button"
          onClick={(e) => {
            // Evita que el disparador se abra si el foco se mueve solo.
            e.stopPropagation();
            onClear();
          }}
          aria-label={clearAriaLabel ?? `Quitar filtro de ${label.toLowerCase()}`}
          className="-ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-primary/70 transition-colors hover:bg-primary/15 hover:text-primary"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
