"use client";

import { cn } from "@/lib/utils";

/**
 * Segmented control compacto para filtros de estado inline en headers de
 * sección. Ver la signature "FilterPill" en DESIGN.md.
 *
 * El markup existía copiado a mano en cuatro lugares (`dashboard-reservas-table`,
 * `occupancy-strip`, `support-list`, `admin-support-list`) y ya había divergido:
 * dos llevan `aria-pressed` y dos no. Este primitive lo fija; migrar los otros
 * tres callsites queda como seguimiento aparte.
 *
 * **Contraste conocido:** `text-primary-foreground` sobre `bg-primary` mide
 * 2.28:1 en claro y 2.17:1 en oscuro — el único par de tokens del sistema que
 * falla AA en ambos temas. Es deuda de tokens de marca documentada en DESIGN.md,
 * no algo que se arregle en este componente.
 */
export interface FilterPillOption<T extends string> {
  value: T;
  label: string;
}

export function FilterPill<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: ReadonlyArray<FilterPillOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Nombre del grupo para lectores de pantalla, p. ej. "Vista temporal". */
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1 rounded-full border border-border bg-muted p-1",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "cursor-pointer rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
            value === option.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
