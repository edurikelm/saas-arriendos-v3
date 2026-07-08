"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, AlertTriangle } from "lucide-react";

export interface ExecutiveKpiCardProps {
  label: string;
  value: string | number;
  trend?: {
    direction: "up" | "down" | "flat" | "warning" | "info";
    label: string;
  };
  sublabel?: string;
  tone?: "default" | "warning" | "destructive";
}

export function ExecutiveKpiCard({
  label,
  value,
  trend,
  sublabel,
  tone = "default",
}: ExecutiveKpiCardProps) {
  return (
    <div className="bg-card border border-border rounded p-4">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className={cn(
          "text-xl font-bold tabular-nums",
          tone === "warning" && "text-warning",
          tone === "destructive" && "text-destructive",
          tone === "default" && "text-foreground"
        )}
      >
        {value}
      </p>
      {trend && (
        <p
          className={cn(
            "text-[10px] font-medium mt-1 flex items-center gap-0.5",
            trend.direction === "warning" ? "text-destructive" : "text-primary"
          )}
        >
          {trend.direction === "up" && <TrendingUp className="size-3" />}
          {trend.direction === "warning" && <AlertTriangle className="size-3" />}
          {trend.label}
        </p>
      )}
      {sublabel && !trend && (
        <p className="text-[10px] text-muted-foreground font-medium mt-1">
          {sublabel}
        </p>
      )}
    </div>
  );
}
