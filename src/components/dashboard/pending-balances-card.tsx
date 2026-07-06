import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  ReceiptText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SaldoItem {
  reservationId: string;
  reservation: {
    client: { name: string };
    property: { name: string };
  };
  pending: number;
}

interface PendingBalancesCardProps {
  saldos: SaldoItem[];
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Lista de reservas con saldo pendiente.
 *
 * Distinta semántica a `UrgentCollectionCard`: aquí no hay `dueDate`
 * puntual sino un saldo global por reserva. El owner navega a la
 * reserva para operar (cuotas extra, ver detalle, etc.).
 */
export function PendingBalancesCard({ saldos }: PendingBalancesCardProps) {
  const total = saldos.reduce((acc, s) => acc + s.pending, 0);
  const count = saldos.length;

  return (
    <Card aria-label="Saldos pendientes" className="h-full">
      <CardHeader className="border-b pb-4">
        <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-md border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <CircleDollarSign className="size-3.5" />
          Saldos
        </div>
        <CardTitle>Saldos pendientes</CardTitle>
        <CardDescription>
          Reservas activas o futuras con pago aún incompleto.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        {count === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            <p className="flex items-center justify-center gap-2">
              <Check className="size-4 text-success" aria-hidden />
              Sin saldos pendientes. Todas las reservas activas están pagadas.
            </p>
          </div>
        ) : (
          <>
            {/* Bloque inline: total + count en una sola línea */}
            <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-destructive opacity-70">
                  Saldo total
                </p>
                <p className="text-xl font-semibold text-destructive sm:text-2xl">
                  {formatCLP(total)}
                </p>
              </div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {count} {count === 1 ? "reserva" : "reservas"}
              </p>
            </div>

            {/* Lista con separadores + botón full-width al pie de cada item */}
            <ul className="divide-y divide-border">
              {saldos.map((item) => (
                <li key={item.reservationId} className="py-4 first:pt-0 last:pb-0">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.reservation.client.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.reservation.property.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground opacity-70">
                        Saldo
                      </p>
                      <p className="text-sm font-bold text-destructive">
                        {formatCLP(item.pending)}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/reservations?reservationId=${item.reservationId}`}
                    className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium uppercase tracking-wide transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <ReceiptText className="size-3.5" />
                    Ver reserva
                    <ArrowRight className="size-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
