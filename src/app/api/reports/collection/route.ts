import { NextResponse } from "next/server";
import { getCollectionReport } from "@/lib/actions/reports";
import type { CollectionBillingFilter, CollectionDebtStatusFilter } from "@/lib/reports/collection";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const billingType = (searchParams.get("billingType") || undefined) as CollectionBillingFilter | undefined;
    const propertyId = searchParams.get("propertyId") || undefined;
    const clientId = searchParams.get("clientId") || undefined;
    const debtStatus = (searchParams.get("debtStatus") || undefined) as CollectionDebtStatusFilter | undefined;
    const dueDateFrom = searchParams.get("dueDateFrom") ? new Date(searchParams.get("dueDateFrom")!) : undefined;
    const dueDateTo = searchParams.get("dueDateTo") ? new Date(searchParams.get("dueDateTo")!) : undefined;

    const result = await getCollectionReport({
      page, limit, billingType, propertyId, clientId, debtStatus, dueDateFrom, dueDateTo,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching collection report:", error);
    return NextResponse.json({ error: "Error al obtener reporte de cobranza" }, { status: 500 });
  }
}
