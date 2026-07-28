import { cn } from "@/lib/utils";

export interface ModelDistributionCardProps {
  title: string;
  description: string;
  /** Cash collected for this billing type in the range. */
  collectedCash: number;
  /** Percentage of total collectedCash (decisionSummary.collectedCash). */
  cashSharePercentage: number;
  /** Outstanding balance for this billing type. */
  outstandingBalance: number;
  /** Occupancy rate for this billing type (0-100). */
  occupancyRate: number;
  /** Occupied night-units for this billing type. */
  occupiedNightUnits: number;
  /** Capacity night-units for this billing type. */
  capacityNightUnits: number;
  /** Number of active reservations for this billing type. */
  reservationCount: number;
  /** Cash collected from cancelled reservations within the billing type. */
  cancelledCash: number;
  variant: "primary" | "secondary";
}

export function ModelDistributionCard({
  title,
  description,
  collectedCash,
  cashSharePercentage,
  outstandingBalance,
  occupancyRate,
  occupiedNightUnits,
  capacityNightUnits,
  reservationCount,
  cancelledCash,
  variant,
}: ModelDistributionCardProps) {
  return (
    <div className="bg-card border border-border rounded p-5 flex items-start justify-between gap-4">
      <div className="flex flex-col min-w-0">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">
          {title}
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3">{description}</p>

        {/* Valor principal con label visible */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground">
            ${collectedCash.toLocaleString("CLP")}
          </span>
          <span className="text-[11px] text-muted-foreground">Cobrado de arriendo</span>
        </div>

        {/* % del cobrado de arriendo */}
        <div className="flex items-baseline gap-1 mt-0.5">
          <span
            className={cn(
              "text-[10px] font-medium",
              variant === "primary" ? "text-primary" : "text-primary/70"
            )}
          >
            {cashSharePercentage}% del cobrado de arriendo
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {/* Saldo pendiente */}
          <p className="text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">
              ${outstandingBalance.toLocaleString("CLP")}
            </span>{" "}
            Saldo pendiente
          </p>

          {/* Ocupación por Reservas */}
          <p className="text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">
              {occupiedNightUnits.toLocaleString("es-CL")}
            </span>
            {" / "}
            <span className="font-medium text-foreground">
              {capacityNightUnits.toLocaleString("es-CL")}
            </span>{" "}
            unidades-noche ocupación por Reservas
          </p>

          {/* Reservas */}
          <p className="text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">{reservationCount}</span> reserva
            {reservationCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Nota de canceladas */}
        {cancelledCash > 0 && (
          <p className="text-[10px] text-muted-foreground mt-2 italic">
            Incluye ${cancelledCash.toLocaleString("CLP")} cobrados de Reservas canceladas
          </p>
        )}
      </div>

      <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 36 36"
        >
          {/* Background ring */}
          <circle
            className="stroke-muted"
            cx="18"
            cy="18"
            fill="none"
            r="15.915"
            strokeWidth="3"
          />
          {/* Progress ring */}
          <circle
            className={cn(
              variant === "primary" ? "stroke-primary" : "stroke-primary/40"
            )}
            cx="18"
            cy="18"
            fill="none"
            r="15.915"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${cashSharePercentage}, 100`}
            strokeDashoffset="0"
          />
        </svg>
        <span
          className={cn(
            "absolute text-xs font-bold",
            variant === "primary" ? "text-primary" : "text-primary/70"
          )}
        >
          {cashSharePercentage}%
        </span>
      </div>
    </div>
  );
}
