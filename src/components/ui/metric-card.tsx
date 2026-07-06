import { type LucideIcon } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardTone = "neutral" | "success" | "info" | "warning" | "destructive";
type MetricCardStatus = "ok" | "warning" | "critical" | "neutral";

const toneToBadgeVariant: Record<MetricCardTone, "default" | "secondary" | "success" | "warning" | "info" | "destructive"> = {
  neutral: "secondary",
  success: "success",
  info: "info",
  warning: "warning",
  destructive: "destructive",
};

const statusDotColor: Record<MetricCardStatus, string> = {
  ok: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
  neutral: "bg-muted-foreground",
};

function StatusDot({ status }: { status: MetricCardStatus }) {
  const labels: Record<MetricCardStatus, string> = {
    ok: "Estado OK",
    warning: "Estado con advertencia",
    critical: "Estado crítico",
    neutral: "Estado neutro",
  };

  return (
    <span
      className={cn("size-2 rounded-full", statusDotColor[status])}
      aria-label={labels[status]}
      role="status"
    />
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: MetricCardTone;
  status?: MetricCardStatus;
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  status = "neutral",
}: MetricCardProps) {
  const badgeVariant = toneToBadgeVariant[tone];

  return (
    <Card className="min-h-32 justify-between transition-colors hover:bg-muted/30">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </CardTitle>
          <CardAction>
            <div className="flex items-center gap-2">
              <StatusDot status={status} />
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl",
                  // Badge semantic token mapping — no hardcoded colors
                  badgeVariant === "default" && "bg-primary text-primary-foreground",
                  badgeVariant === "secondary" && "bg-secondary text-secondary-foreground",
                  badgeVariant === "success" && "bg-success/10 text-success",
                  badgeVariant === "warning" && "bg-warning/10 text-warning-foreground",
                  badgeVariant === "info" && "bg-info/10 text-info-foreground",
                  badgeVariant === "destructive" && "bg-destructive/10 text-destructive"
                )}
              >
                <Icon className="size-4" />
              </span>
            </div>
          </CardAction>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {value}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export { MetricCard, type MetricCardProps };
