import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface DashboardSectionProps {
  /** `id` del `<h2>`; la sección se nombra con él (`aria-labelledby`). */
  headingId: string;
  title: string;
  /** Resumen de una línea bajo el título ("4 de 7 ocupadas hoy"). */
  meta?: ReactNode;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
}

/**
 * Card de una sección del inicio: el título vive DENTRO de la card, en una
 * banda `bg-muted/40`, y no como label suelto encima.
 *
 * Con las secciones en columnas angostas, un label de 10px flotando sobre cada
 * card dejaba la página sin ancla: todo tenía el mismo peso. La banda da un
 * segundo plano tonal sin sombra (Calm Water, DESIGN.md) y el título pasa a
 * `text-sm`, un escalón claro sobre los datos de las filas.
 *
 * Columna flex de alto completo: donde el inicio pone dos secciones lado a
 * lado (agenda y cobros), las dos miden lo mismo, y el pie de cada una
 * (`mt-auto`) queda abajo en vez de flotar a media card.
 */
export function DashboardSection({
  headingId,
  title,
  meta,
  action,
  children,
  className,
}: DashboardSectionProps) {
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-medium text-foreground">
            {title}
          </h2>
          {meta && <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{meta}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-primary-text underline-offset-4 hover:underline"
          >
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
