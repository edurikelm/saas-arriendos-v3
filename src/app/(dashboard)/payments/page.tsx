import { getSession } from "@/lib/actions/auth";
import { getPayments, getCollectionAlerts } from "@/lib/actions/payments";
import { getProperties } from "@/lib/actions/properties";
import { UrgentCollectionCard } from "@/components/dashboard/urgent-collection-card";
import { PaymentsFilters } from "./_components/payments-filters";
import { PaymentsTable } from "./_components/payments-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Pagos — RentalPro" };

interface PaymentsPageProps {
  searchParams: Promise<{
    propertyId?: string;
    method?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const session = await getSession();
  if (!session) return null;

  const params = await searchParams;
  const page = Number(params.page ?? "1");

  const [{ payments, total, totalPages }, properties, collectionAlerts] = await Promise.all([
    getPayments({
      propertyId: params.propertyId,
      method: params.method,
      status: params.status,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page,
      limit: 20,
    }),
    getProperties(),
    getCollectionAlerts(),
  ]);

  const filterProps = {
    propertyId: params.propertyId ?? "",
    method: params.method ?? "",
    status: params.status ?? "",
    dateFrom: params.dateFrom ?? "",
    dateTo: params.dateTo ?? "",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pagos</h1>
        <p className="text-muted-foreground text-sm">
          Gestiona tus pagos y cobrazas pendientes
        </p>
      </div>

      {/* Cobranza urgente widget */}
      <UrgentCollectionCard
        vencidos={collectionAlerts.vencidos}
        vencenHoy={collectionAlerts.vencenHoy}
        proximos7Dias={collectionAlerts.proximos7Dias}
      />

      {/* Filters + Table */}
      <Card>
        <CardHeader>
          <CardTitle>Todos los pagos</CardTitle>
          <CardDescription>
            Listado completo de pagos con filtros por propiedad, método y estado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PaymentsFilters
            properties={properties}
            {...filterProps}
          />
          <PaymentsTable
            payments={payments}
            total={total}
            totalPages={totalPages}
            page={page}
          />
        </CardContent>
      </Card>
    </div>
  );
}
