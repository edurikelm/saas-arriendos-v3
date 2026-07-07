import { AlertTriangle, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type StitchKpiIndicatorVariant = "positive" | "warning" | "neutral";

export interface StitchKpiCardProps {
  label: string;
  value: string | number;
  unit?: string;
  indicator?: {
    text: string;
    variant: StitchKpiIndicatorVariant;
  };
  progressBar?: {
    value: number;
  };
}

function IndicatorIcon({ variant }: { variant: StitchKpiIndicatorVariant }) {
  if (variant === "positive") return <TrendingUp className="h-3 w-3" />;
  if (variant === "warning") return <AlertTriangle className="h-3 w-3" />;
  return null;
}

function indicatorClasses(variant: StitchKpiIndicatorVariant): string {
  if (variant === "positive") return "text-primary";
  if (variant === "warning") return "text-destructive";
  return "text-muted-foreground";
}

export function StitchKpiCard({ label, value, unit, indicator, progressBar }: StitchKpiCardProps) {
  const progressValue = progressBar ? Math.max(0, Math.min(100, progressBar.value)) : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-foreground">{value}</span>
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
      {indicator && (
        <div className={`mt-1 flex items-center gap-0.5 text-[10px] font-medium ${indicatorClasses(indicator.variant)}`}>
          <IndicatorIcon variant={indicator.variant} />
          <span>{indicator.text}</span>
        </div>
      )}
      {progressValue !== null && (
        <div className="mt-2 h-1 w-full rounded-full bg-muted">
          <div className="h-1 rounded-full bg-primary" style={{ width: `${progressValue}%` }} />
        </div>
      )}
    </div>
  );
}