import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, TrendingUp } from "lucide-react";

export type KpiTone = "default" | "success" | "info" | "warning" | "destructive";
export type KpiIndicatorVariant = "positive" | "warning" | "neutral";

export type KpiCardDensity = "comfortable" | "compact";

export interface KpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: LucideIcon;
  tone?: KpiTone;
  indicator?: {
    text: string;
    variant: KpiIndicatorVariant;
  };
  progressBar?: {
    value: number;
  };
  sublabel?: string;
  // Opt-in only — default "comfortable" preserves today's render on all 9
  // existing surfaces (dashboard, reports, payments, admin, clientes,
  // soporte, detalle de reserva...). "compact" hides icon/indicator/progress
  // bar below `sm` to fit a 2x2 grid above the fold on /calendar mobile;
  // from `sm` up it renders identically to "comfortable" either way.
  density?: KpiCardDensity;
}

// Tonos para el icon container (esquina superior derecha del card). El icono
// va sobre el fondo TINTADO (bg-{tone}/10), no sobre --card, pero el mismo
// Fill-vs-Text Rule aplica: medido, "text-success"/"text-info"/"text-warning"
// (relleno) sobre su propio tinte al 10% dan 2.59:1 / 2.55:1 / 1.81:1 en claro,
// bajo el piso de 3:1 que WCAG 1.4.11 pide a un grafico no-textual. El
// companero legible es el "-text" de cada tono, que pasa el 3:1 sobre el tinte
// sin apagar el color (ver The Fill-vs-Text Rule en DESIGN.md).
const iconContainerToneClass: Record<KpiTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success-text",
  info: "bg-info/10 text-info-text",
  warning: "bg-warning/10 text-warning-text",
  destructive: "bg-destructive/10 text-destructive-text",
};

// Tonos para el value text — success/warning/destructive colorean el número;
// default e info quedan en foreground (estados neutros sin énfasis de color).
// The Fill-vs-Text Rule (DESIGN.md): --success/--warning son tokens de RELLENO,
// no de texto — medidos sobre --card en claro dan 3.03:1 / 2.05:1, bajo AA.
// Los "-foreground" tampoco: ese nivel es para texto ENCIMA del relleno opaco
// del mismo tono, y a L=0.27-0.40 sobre card se leen negros — el tono deja de
// comunicar, que es el unico trabajo de un valor coloreado. Va el "-text" de
// cada tono, que se sienta en ~5.3:1 igual que --destructive-text: pasa AA y
// sigue leyendose verde y ambar.
const valueToneClass: Record<KpiTone, string> = {
  default: "text-foreground",
  success: "text-success-text",
  info: "text-foreground",
  warning: "text-warning-text",
  destructive: "text-destructive-text",
};

function IndicatorIcon({ variant }: { variant: KpiIndicatorVariant }) {
  if (variant === "positive") return <TrendingUp className="h-3 w-3" />;
  if (variant === "warning") return <AlertTriangle className="h-3 w-3" />;
  return null;
}

function indicatorClasses(variant: KpiIndicatorVariant): string {
  // text-success-text: es texto de 10px sobre --card, no sobre el relleno del
  // mismo tono, asi que el nivel que aplica es "-text", no "-foreground" (Fill-
  // vs-Text Rule, DESIGN.md). Antes esto usaba text-success-foreground, que
  // pasa AA pero esta pensado para sentarse ENCIMA de bg-success opaco (texto
  // de badge relleno): a L=0.28 sobre --card se lee negro, y un indicator que
  // no comunica el tono no esta haciendo su trabajo. Numericamente pasaba; era
  // el nivel equivocado igual.
  if (variant === "positive") return "text-success-text";
  // text-warning-text por la misma razon. NOT text-destructive-foreground: ese
  // token es blanco a proposito — --destructive dobla como relleno solido de
  // boton destructivo — y sobre --card (blanco en claro) da 1.00:1, invisible.
  // Ver issue #235 para el problema hermano en --destructive mismo.
  if (variant === "warning") return "text-warning-text";
  return "text-muted-foreground";
}

export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "default",
  indicator,
  progressBar,
  sublabel,
  density = "comfortable",
}: KpiCardProps) {
  const progressValue = progressBar ? Math.max(0, Math.min(100, progressBar.value)) : null;
  const isCompact = density === "compact";

  return (
    <div role="group" aria-label={label} className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg sm:size-9 sm:rounded-xl",
              isCompact && "hidden sm:flex",
              iconContainerToneClass[tone]
            )}
            aria-hidden="true"
          >
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        {/* Value: text-lg en mobile (cabe en grid 2-col), text-xl en sm+ */}
        <span className={cn("text-lg font-bold tabular-nums sm:text-xl", valueToneClass[tone])}>
          {value}
        </span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      {sublabel && (
        <p className="mt-1 text-[10px] text-muted-foreground">{sublabel}</p>
      )}
      {indicator && (
        <div
          className={cn(
            "mt-1 flex items-center gap-0.5 text-[10px] font-medium",
            isCompact && "hidden sm:flex",
            indicatorClasses(indicator.variant)
          )}
        >
          <IndicatorIcon variant={indicator.variant} />
          <span>{indicator.text}</span>
        </div>
      )}
      {progressValue !== null && (
        <div className={cn("mt-2 h-1 w-full rounded-full bg-muted", isCompact && "hidden sm:block")}>
          <div
            className="h-1 rounded-full bg-primary"
            style={{ width: `${progressValue}%` }}
          />
        </div>
      )}
    </div>
  );
}
