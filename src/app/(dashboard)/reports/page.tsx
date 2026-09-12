import { startOfMonth, endOfMonth } from "date-fns";
import { getDecisionSummary, getOutstandingSnapshot, type OutstandingSnapshot } from "@/lib/actions/reports";
import type { ReportDecisionSummary } from "@/lib/reports/decision-summary";
import { getProperties } from "@/lib/actions/properties";
import { getSession } from "@/lib/auth/session";
import { ReportsClient } from "./_components/reports-client";

export const dynamic = "force-dynamic";

interface Property { id: string; name: string; unitsAvailable: number; }
interface SessionInfo { plan: string | null; }

export default async function ReportsPage() {
  // Default date range = "current_month" (matches client's initial quickRange: "current_month")
  const now = new Date();
  const defaultStartDate = startOfMonth(now);
  const defaultEndDate = endOfMonth(now);

  const [
    initialSnapshot,
    initialProperties,
    initialSession,
    initialDecisionSummary,
  ] = await Promise.all([
    getOutstandingSnapshot(),
    getProperties(),
    getSession(),
    getDecisionSummary({ rangeStart: defaultStartDate, rangeEnd: defaultEndDate, propertyId: undefined }),
  ]);

  const initialSessionInfo: SessionInfo = {
    plan: initialSession?.plan ?? null,
  };

  return (
    <ReportsClient
      initialSnapshot={initialSnapshot as OutstandingSnapshot | null}
      initialProperties={initialProperties as Property[]}
      initialSession={initialSessionInfo}
      initialDecisionSummary={initialDecisionSummary as ReportDecisionSummary | null}
    />
  );
}
