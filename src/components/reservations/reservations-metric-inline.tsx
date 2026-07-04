"use client";

import { cn } from "@/lib/utils";

interface MetricCardInlineProps {
  label: string;
  value: string;
  sublabel?: string;
  tone: "info" | "success" | "warning" | "neutral";
  className?: string;
}

const toneStyles: Record<MetricCardInlineProps["tone"], { border: string; bg: string; text: string }> = {
  info: {
    border: "border-info/15",
    bg: "bg-info/10",
    text: "text-info-foreground",
  },
  success: {
    border: "border-success/15",
    bg: "bg-success/10",
    text: "text-success-foreground",
  },
  warning: {
    border: "border-warning/15",
    bg: "bg-warning/10",
    text: "text-warning-foreground",
  },
  neutral: {
    border: "border-muted",
    bg: "bg-muted",
    text: "text-muted-foreground",
  },
};

const labelTone: Record<MetricCardInlineProps["tone"], string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  neutral: "text-muted-foreground",
};

export function MetricCardInline({ label, value, sublabel, tone, className }: MetricCardInlineProps) {
  const styles = toneStyles[tone];
  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br p-3 sm:p-4",
        styles.border,
        styles.bg,
        className
      )}
    >
      <p className={cn("text-[0.65rem] font-medium uppercase tracking-wide sm:text-xs", labelTone[tone])}>
        {label}
      </p>
      <p className={cn("mt-1.5 text-xl font-bold tabular-nums text-foreground sm:mt-2 sm:text-2xl", styles.text)}>
        {value}
      </p>
      {sublabel && (
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}
