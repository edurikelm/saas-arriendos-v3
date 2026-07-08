"use client";

import { cn } from "@/lib/utils";

export interface ModelDistributionCardProps {
  title: string;
  description: string;
  amount: number;
  percentage: number;
  reservationCount?: number;
  variant: "primary" | "secondary";
}

export function ModelDistributionCard({
  title,
  description,
  amount,
  percentage,
  reservationCount,
  variant,
}: ModelDistributionCardProps) {
  return (
    <div className="bg-card border border-border rounded p-5 flex items-center justify-between">
      <div className="flex flex-col">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">
          {title}
        </h3>
        <p className="text-[11px] text-muted-foreground mb-4">{description}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground">
            ${amount.toLocaleString("CLP")}
          </span>
          <span
            className={cn(
              "text-[10px] font-medium",
              variant === "primary" ? "text-primary" : "text-primary/70"
            )}
          >
            {percentage}% del total
          </span>
        </div>
        {reservationCount !== undefined && (
          <p className="text-[10px] text-muted-foreground mt-1">
            {reservationCount} reserva{reservationCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>
      <div className="relative flex items-center justify-center w-24 h-24 shrink-0">
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
            strokeDasharray={`${percentage}, 100`}
            strokeDashoffset="0"
          />
        </svg>
        <span
          className={cn(
            "absolute text-xs font-bold",
            variant === "primary" ? "text-primary" : "text-primary/70"
          )}
        >
          {percentage}%
        </span>
      </div>
    </div>
  );
}
