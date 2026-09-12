import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCLP } from "@/lib/format/currency";
import type { AgingBucket, AgingBucketKey } from "@/lib/reports/collection";

interface AgingBucketsPanelProps {
  buckets: AgingBucket[];
}

/**
 * Fill del tramo — severidad creciente sobre el MISMO tono (destructive),
 * salvo "vence en 7 días" que usa warning (todavía no es mora). Fill-vs-Text
 * Rule: el fill es solo relleno de la barra; el texto usa siempre `-text`.
 */
const BUCKET_FILL: Record<AgingBucketKey, string> = {
  DUE_SOON: "bg-warning",
  OVERDUE_1_30: "bg-destructive/50",
  OVERDUE_31_60: "bg-destructive/75",
  OVERDUE_60_PLUS: "bg-destructive",
};

const BUCKET_TEXT: Record<AgingBucketKey, string> = {
  DUE_SOON: "text-warning-text",
  OVERDUE_1_30: "text-destructive-text",
  OVERDUE_31_60: "text-destructive-text",
  OVERDUE_60_PLUS: "text-destructive-text",
};

/**
 * 4 tramos de antigüedad de deuda, como barras horizontales. Siempre
 * renderiza los 4 (incluso en 0) — `buildAgingBuckets` ya garantiza el orden
 * y la presencia de los 4, así que la UI no necesita condicionales por tramo
 * vacío.
 */
export function AgingBucketsPanel({ buckets }: AgingBucketsPanelProps) {
  const maxAmount = Math.max(...buckets.map((b) => b.amount), 1);
  const allEmpty = buckets.every((b) => b.amount <= 0);

  if (allEmpty) {
    return (
      <div className="flex items-center gap-2 py-2">
        <CheckCircle2 className="size-4 text-success-text" aria-hidden="true" />
        <p className="text-xs text-muted-foreground">Sin cobros vencidos ni por vencer en los próximos 7 días.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {buckets.map((bucket) => {
        const widthPct = bucket.amount > 0 ? Math.max((bucket.amount / maxAmount) * 100, 4) : 0;
        return (
          <div key={bucket.key}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-xs font-medium text-foreground">{bucket.label}</span>
              <span className={cn("text-xs font-bold tabular-nums shrink-0", BUCKET_TEXT[bucket.key])}>
                {bucket.count} {bucket.count === 1 ? "cobro" : "cobros"} · {formatCLP(bucket.amount)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", BUCKET_FILL[bucket.key])}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
