import { cn } from "@/lib/utils";

/**
 * Semantic tones for ReservationPill.
 *
 * Extends the standard 4 semantic tokens (success/warning/info/destructive)
 * with project-specific variants:
 * - "info-strong": higher-contrast variant of info (for MONTHLY billing)
 * - "neutral": muted tone for finalized/cancelled states
 */
export type PillTone =
  | "success"
  | "info"
  | "info-strong"
  | "warning"
  | "destructive"
  | "neutral";

// The Fill-vs-Text Rule (DESIGN.md): sobre su propio tinte al 10%, los tokens de
// RELLENO median 2.73 / 2.67 / 2.26 / 1.91:1 en claro — bajo AA, en el pill que
// muestra el estado principal de la reserva. `destructive` ya se habia migrado
// con #235; los otros cuatro se quedaron atras. El companero legible es el
// `-text` de cada tono, que ademas sigue leyendose verde, cyan y ambar.
const toneClassNames: Record<PillTone, string> = {
  success: "border-success/20 bg-success/10 text-success-text",
  info: "border-info/20 bg-info/10 text-info-text",
  // `info-strong` distinguia su urgencia subiendo el tinte a `bg-info/25`, y ese
  // tinte se comia el contraste del texto: 3.94:1 en claro. La distincion pasa al
  // BORDE, que no cuesta contraste — mismo fondo que `info` (4.69:1) y borde
  // opaco contra el 20% del otro. El par relleno documentado del Badge no servia
  // aca: `bg-info` + `text-info-foreground` mide 1.58:1 en oscuro, porque en ese
  // tema los dos tokens son claros.
  "info-strong": "border-info bg-info/10 text-info-text",
  warning: "border-warning/25 bg-warning/10 text-warning-text",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive-text",
  // `text-muted-foreground` sobre `bg-muted` medía 4.32:1, bajo AA a 9px. El
  // fondo gris ya carga la señal de "inactiva"; el texto no necesita apagarse
  // ademas, y apagado no se leia.
  neutral: "border-muted bg-muted text-foreground",
};

const dotClassNames: Record<PillTone, string> = {
  success: "bg-success",
  info: "bg-info",
  "info-strong": "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
  neutral: "bg-muted-foreground",
};

/**
 * Vertical bar color for a pill tone. Used by the desktop reservation table
 * to render left accent stripes on finance cells (decorative, outside the pill).
 */
export const reservationPillDotClass: Record<PillTone, string> = dotClassNames;

export interface ReservationPillProps {
  tone: PillTone;
  label: string;
  className?: string;
}

/**
 * Inline status pill used in reservation-related UI (table rows, mobile cards,
 * compact lists). Not for general-purpose status badges — use `<Badge>` instead.
 *
 * See DESIGN.md section "ReservationPill" for the canonical visual contract.
 */
export function ReservationPill({ tone, label, className }: ReservationPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-tight",
        toneClassNames[tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClassNames[tone])} />
      {label}
    </span>
  );
}