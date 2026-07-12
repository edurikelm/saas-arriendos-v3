import { startOfMonth, endOfMonth } from "date-fns";
import { getDashboardStats, getRevenueReport, getOccupancyReport, getYearlySummary, getReservationsReport, getCollectionReport } from "@/lib/actions/reports";
import type { DashboardStats, RevenueReport, OccupancyReport, ReservationReport } from "@/lib/actions/reports";
import type { CollectionReportRow } from "@/lib/reports/collection";
import { getProperties } from "@/lib/actions/properties";
import { getSession } from "@/lib/auth/session";
import { type ReservationDetail } from "@/lib/export-utils";
import { ReportsClient } from "./_components/reports-client";

export const dynamic = "force-dynamic";

type YearlySummary = Awaited<ReturnType<typeof getYearlySummary>>;

interface Property { id: string; name: string; unitsAvailable: number; }
interface SessionInfo { plan: string | null; }

export default async function ReportsPage() {
  // Default date range = "current_month" (matches client's initial quickRange: "current_month")
  const now = new Date();
  const defaultStartDate = startOfMonth(now);
  const defaultEndDate = endOfMonth(now);
  const defaultYear = now.getFullYear();

  const [
    initialStats,
    initialRevenueData,
    initialOccupancyData,
    initialYearlySummary,
    initialReservations,
    initialCollection,
    initialProperties,
    initialSession,
  ] = await Promise.all([
    getDashboardStats(),
    getRevenueReport({
      months: undefined,
      year: defaultYear,
      startDate: defaultStartDate,
      endDate: defaultEndDate,
    }),
    getOccupancyReport({
      propertyId: undefined,
      startDate: defaultStartDate,
      endDate: defaultEndDate,
    }),
    getYearlySummary(defaultYear),
    getReservationsReport({
      propertyId: undefined,
      status: undefined,
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
  ]);

  // Transform ReservationReport[] (with Date fields from DB) to ReservationDetail[] (Date objects)
  // to match what the client component expects
  const initialReservationDetails: ReservationDetail[] = (initialReservations || []).map(
    (r: ReservationReport) => ({
      id: r.id,
      propertyName: r.propertyName,
      clientName: r.clientName,
      clientEmail: r.clientEmail,
      startDate: new Date(r.startDate),
      endDate: new Date(r.endDate),
      totalPrice: Number(r.totalPrice),
      status: r.status,
      paymentStatus: r.paymentStatus,
      billingType: r.billingType,
      createdAt: new Date(r.createdAt),
    })
  );

  // Extract collection pagination info
  let initialCollectionRows: CollectionReportRow[] = [];
  let initialCollectionTotal = 0;
  let initialCollectionTotalPages = 0;
  if (initialCollection && "data" in initialCollection) {
    initialCollectionRows = initialCollection.data;
    initialCollectionTotal = initialCollection.total;
    initialCollectionTotalPages = initialCollection.totalPages;
  }

  const initialSessionInfo: SessionInfo = {
    plan: initialSession?.plan ?? null,
  };

  return (
    <ReportsClient
      initialStats={initialStats as DashboardStats}
      initialRevenueData={initialRevenueData as RevenueReport[]}
      initialOccupancyData={initialOccupancyData as OccupancyReport[]}
      initialYearlySummary={initialYearlySummary as YearlySummary}
      initialReservationDetails={initialReservationDetails}
      initialCollectionRows={initialCollectionRows}
      initialCollectionTotal={initialCollectionTotal}
      initialCollectionTotalPages={initialCollectionTotalPages}
      initialProperties={initialProperties as Property[]}
      initialSession={initialSessionInfo}
    />
  );
}
