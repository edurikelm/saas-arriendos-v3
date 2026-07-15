import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getPayments, getPaymentsKpis } from "@/lib/actions/payments";
import { getProperties } from "@/lib/actions/properties";
import { PaymentsKpis } from "@/components/payments/payments-kpis";
import { PaymentsFilters } from "./_components/payments-filters";
import { PaymentsTableClient } from "./_components/payment-actions";
import { PaginationWrapper } from "./_components/pagination-wrapper";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReceiptText, X } from "lucide-react";

export const metadata = { title: "Pagos — RentalPro" };

interface PaymentsPageProps {
  searchParams: Promise<{
    propertyId?: string;
    method?: string;
    status?: string;
    paymentType?: string;
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

  const [{ payments, total, totalPages }, properties, kpis] = await Promise.all([
    getPayments({
      propertyId: params.propertyId,
      method: params.method,
      status: params.status,
      paymentType: params.paymentType,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page,
      limit: 20,
    }),
    getProperties(),
    getPaymentsKpis(),
  ]);

  const filterProps = {
    propertyId: params.propertyId ?? "",
    method: params.method ?? "",
    status: params.status ?? "",
    paymentType: params.paymentType ?? "",
    dateFrom: params.dateFrom ?? "",
    dateTo: params.dateTo ?? "",
  };

  const hasFilters = Object.values(filterProps).some(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Pagos</h1>
          <p className="text-xs text-muted-foreground">
            Gestión de ingresos, facturación y conciliación bancaria
          </p>
        </div>
      </div>

      {/* KPIs */}
      <PaymentsKpis kpis={kpis} />

      {/* Filters */}
      <PaymentsFilters
        properties={properties}
        {...filterProps}
      />

      {/* Counter */}
      {payments.length > 0 && (
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Mostrando {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} de {total} pago{total !== 1 ? "s" : ""}
        </div>
      )}

      {/* Table OR Empty State */}
      {payments.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center">
          <ReceiptText className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-medium">No hay pagos</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasFilters
              ? "Ningún pago coincide con los filtros seleccionados."
              : "Aún no tienes pagos registrados."}
          </p>
          {hasFilters && (
            <Link
              href="/payments"
              className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
            >
              <X className="mr-2 h-4 w-4" />
              Limpiar filtros
            </Link>
          )}
        </div>
      ) : (
        <PaymentsTableClient payments={payments} />
      )}

      {/* Pagination condicional */}
      {totalPages > 1 && (
        <PaginationWrapper page={page} totalPages={totalPages} total={total} limit={20} />
      )}
    </div>
  );
}
