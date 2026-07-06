"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

interface PaymentRow {
  id: string;
  amount: string;
  method: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  reservation: {
    property: { name: string };
    client: { name: string };
  };
}

interface PaymentsTableProps {
  payments: PaymentRow[];
  total: number;
  totalPages: number;
  page: number;
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: Date | string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

const statusVariant: Record<string, "success" | "warning" | "destructive" | "secondary" | "default"> = {
  COMPLETED: "success",
  PENDING: "warning",
  FAILED: "destructive",
};

const statusLabel: Record<string, string> = {
  COMPLETED: "Pagado",
  PENDING: "Pendiente",
  FAILED: "Fallido",
};

const methodLabel: Record<string, string> = {
  MERCADO_PAGO: "MP",
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
};

export function PaymentsTable({ payments, total, totalPages, page }: PaymentsTableProps) {
  const router = useRouter();

  if (payments.length === 0) {
    return (
      <DataTable
        headers={["Fecha", "Cliente", "Propiedad", "Monto", "Método", "Estado", "Vencimiento"]}
        emptyState={
          <div className="py-12 text-center text-muted-foreground">
            No hay pagos para los filtros seleccionados
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <DataTable
        headers={["Fecha", "Cliente", "Propiedad", "Monto", "Método", "Estado", "Vencimiento"]}
      >
        {payments.map((payment) => (
          <tr key={payment.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
            <td className="px-4 py-3 text-sm text-muted-foreground">
              {formatDate(payment.createdAt)}
            </td>
            <td className="px-4 py-3 font-medium">
              {payment.reservation.client.name}
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {payment.reservation.property.name}
            </td>
            <td className="px-4 py-3 font-bold tabular-nums">
              {formatCLP(Number(payment.amount))}
            </td>
            <td className="px-4 py-3">
              <Badge variant="outline" className="text-xs">
                {methodLabel[payment.method] ?? payment.method}
              </Badge>
            </td>
            <td className="px-4 py-3">
              <Badge variant={statusVariant[payment.status] ?? "default"} className="text-xs">
                {statusLabel[payment.status] ?? payment.status}
              </Badge>
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              {formatDate(payment.dueDate)}
            </td>
          </tr>
        ))}
      </DataTable>

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={20}
          onPageChange={(p) => router.push(`/payments?page=${p}`)}
        />
      )}
    </div>
  );
}
