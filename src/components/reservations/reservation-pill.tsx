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

const toneClassNames: Record<PillTone, string> = {
  success: "border-success/20 bg-success/10 text-success",
  info: "border-info/20 bg-info/10 text-info",
  "info-strong": "border-info/30 bg-info/25 text-info",
  warning: "border-warning/25 bg-warning/10 text-warning",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
  neutral: "border-muted bg-muted text-muted-foreground",
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
 * Vertical bar color for a pill tone. Used by ReservationMobileCard to render
 * the left accent stripe (decorative, outside the pill itself).
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