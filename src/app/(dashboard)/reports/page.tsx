import { startOfMonth, endOfMonth } from "date-fns";
import { getDashboardStats, getOccupancyReport, getCollectionReport, getDecisionSummary } from "@/lib/actions/reports";
import type { DashboardStats, OccupancyReport } from "@/lib/actions/reports";
import type { CollectionReportRow } from "@/lib/reports/collection";
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
    initialStats,
    initialOccupancyData,
    initialCollection,
    initialProperties,
    initialSession,
    initialDecisionSummary,
  ] = await Promise.all([
    getDashboardStats(),
    getOccupancyReport({
      propertyId: undefined,
      startDate: defaultStartDate,
      endDate: defaultEndDate,
    }),
    getCollectionReport({
      billingType: "GENERAL",
      clientId: undefined,
      debtStatus: "ACTIVE",
      dueDateFrom: undefined,
      dueDateTo: undefined,
      page: 1,
      limit: 10,
    }),
    getProperties(),
    getSession(),
    getDecisionSummary({ rangeStart: defaultStartDate, rangeEnd: defaultEndDate, propertyId: undefined, annualYear: now.getFullYear() }),
  ]);

  // Extract collection pagination info and totals
  let initialCollectionRows: CollectionReportRow[] = [];
  let initialCollectionTotal = 0;
  let initialCollectionTotalPages = 0;
  let initialCollectionTotals = { totalToCollect: 0, totalOverdue: 0, pendingInvoices: 0 };
  if (initialCollection && "data" in initialCollection) {
    initialCollectionRows = initialCollection.data;
    initialCollectionTotal = initialCollection.total;
    initialCollectionTotalPages = initialCollection.totalPages;
    if ("totals" in initialCollection) {
      initialCollectionTotals = initialCollection.totals;
    }
  }

  const initialSessionInfo: SessionInfo = {
    plan: initialSession?.plan ?? null,
  };

  return (
    <ReportsClient
      initialStats={initialStats as DashboardStats}
      initialOccupancyData={initialOccupancyData as OccupancyReport[]}
      initialCollectionRows={initialCollectionRows}
      initialCollectionTotal={initialCollectionTotal}
      initialCollectionTotalPages={initialCollectionTotalPages}
      initialCollectionTotals={initialCollectionTotals}
      initialProperties={initialProperties as Property[]}
      initialSession={initialSessionInfo}
      initialDecisionSummary={initialDecisionSummary as ReportDecisionSummary | null}
    />
  );
}
