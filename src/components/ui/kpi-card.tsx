import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, TrendingUp } from "lucide-react";

export type KpiTone = "default" | "success" | "info" | "warning" | "destructive";
export type KpiIndicatorVariant = "positive" | "warning" | "neutral";

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
}

// Tonos para el icon container (esquina superior derecha del card)
const iconContainerToneClass: Record<KpiTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

// Tonos para el value text — solo warning/destructive colorean el número
const valueToneClass: Record<KpiTone, string> = {
  default: "text-foreground",
  success: "text-foreground",
  info: "text-foreground",
  warning: "text-warning",
  destructive: "text-destructive",
};

function IndicatorIcon({ variant }: { variant: KpiIndicatorVariant }) {
  if (variant === "positive") return <TrendingUp className="h-3 w-3" />;
  if (variant === "warning") return <AlertTriangle className="h-3 w-3" />;
  return null;
}

function indicatorClasses(variant: KpiIndicatorVariant): string {
  if (variant === "positive") return "text-primary";
  if (variant === "warning") return "text-destructive";
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
}: KpiCardProps) {
  const progressValue = progressBar ? Math.max(0, Math.min(100, progressBar.value)) : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              iconContainerToneClass[tone]
            )}
          >
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-xl font-bold tabular-nums", valueToneClass[tone])}>
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
            indicatorClasses(indicator.variant)
          )}
        >
          <IndicatorIcon variant={indicator.variant} />
          <span>{indicator.text}</span>
        </div>
      )}
      {progressValue !== null && (
        <div className="mt-2 h-1 w-full rounded-full bg-muted">
          <div
            className="h-1 rounded-full bg-primary"
            style={{ width: `${progressValue}%` }}
          />
        </div>
      )}
    </div>
  );
}
