import { addDaysToDateKey, nowKeyInBusinessTz } from "@/lib/domain/timezone";
import { getDecisionSummary, getOutstandingSnapshot, type OutstandingSnapshot } from "@/lib/actions/reports";
import type { ReportDecisionSummary } from "@/lib/reports/decision-summary";
import { getProperties } from "@/lib/actions/properties";
import { getSession } from "@/lib/auth/session";
import { ReportsClient } from "./_components/reports-client";

export const dynamic = "force-dynamic";

interface Property { id: string; name: string; unitsAvailable: number; }
interface SessionInfo { plan: string | null; }

export default async function ReportsPage() {
  // Default date range = "current_month" (matches client's initial quickRange: "current_month").
  // El mes es el de Santiago, no el del servidor: en Vercel (UTC) el
  // `startOfMonth(new Date())` de las 21:00 del último día ya es el mes siguiente.
  const todayKey = nowKeyInBusinessTz();
  const rangeStartKey = `${todayKey.slice(0, 7)}-01`;
  const [year, month] = todayKey.split("-").map(Number);
  const nextMonthStartKey = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`;
  const rangeEndKey = addDaysToDateKey(nextMonthStartKey, -1);

  const [
    initialSnapshot,
    initialProperties,
    initialSession,
    initialDecisionSummary,
  ] = await Promise.all([
    getOutstandingSnapshot(),
    getProperties(),
    getSession(),
    getDecisionSummary({ rangeStartKey, rangeEndKey, propertyId: undefined }),
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
