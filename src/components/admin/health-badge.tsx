import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type HealthStatus = "healthy" | "attention" | "overdue" | "dormant";

interface HealthBadgeProps {
  status: HealthStatus;
  className?: string;
  /** Optional custom label. If not provided, uses the default status label. */
  children?: ReactNode;
}

/**
 * Maps health status to semantic Badge variants.
 *
 * - healthy  → success  (owner is active with no warnings)
 * - attention → warning (some attention needed)
 * - overdue  → destructive (critical issues: overdue payments, no properties)
 * - dormant  → secondary (no activity yet)
 */
const statusToVariant: Record<HealthStatus, "success" | "warning" | "destructive" | "secondary" | "info"> = {
  healthy: "success",
  attention: "warning",
  overdue: "destructive",
  dormant: "secondary",
};

const statusLabels: Record<HealthStatus, string> = {
  healthy: "Activo",
  attention: "Atención",
  overdue: "Vencido",
  dormant: "Inactivo",
};

function HealthBadge({ status, className, children }: HealthBadgeProps) {
  return (
    <Badge
      variant={statusToVariant[status]}
      className={cn("rounded-md", className)}
    >
      {children ?? statusLabels[status]}
    </Badge>
  );
}

export { HealthBadge, type HealthStatus };
