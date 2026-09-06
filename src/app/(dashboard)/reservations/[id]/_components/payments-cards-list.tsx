"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PaymentCard } from "./payment-card";
import { getDaysUntilDue, sortByDueDate } from "@/lib/payments/payment-status";
import type { Payment } from "@/components/payments/payments-table";

interface PaymentsCardsListProps {
  payments: Payment[];
  nowKey: string;
  isActive: boolean;
  onGenerateLink?: (paymentId: string) => void;
  onRegenerateLink?: (paymentId: string) => void;
  onMarkPaid?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => void;
  onUploadReceipt?: (paymentId: string, file: File) => Promise<{ error?: string }>;
  onSendLink?: (payment: Payment) => void;
  generatingLinkId?: string | null;
  regeneratingLinkId?: string | null;
  /** Controls the empty-state copy only — celebratory strip was removed (2026-Q3 cleanup). */
  variant?: "reservation" | "extra";
  /** Id del primer pago vencido — recibe el foco desde la focus card de la sección. */
  firstOverdueId?: string | null;
  /** Abre el diálogo de agregar pago desde el empty state. */
  onAddPayment?: () => void;
}

export function PaymentsCardsList({
  payments,
  nowKey,
  isActive,
  onGenerateLink,
  onRegenerateLink,
  onMarkPaid,
  onDeletePayment,
  onUploadReceipt,
  onSendLink,
  generatingLinkId,
  regeneratingLinkId,
  variant = "reservation",
  firstOverdueId,
  onAddPayment,
}: PaymentsCardsListProps) {
  // Variant-driven copy — diferenciado por variant en estado activo e inactivo
  // para que las dos secciones de la reserva (arriendo + extras) tengan copy propia.
  const activeEmptyMessage =
    variant === "extra"
      ? "Aún no hay cobros extra registrados"
      : "Aún no hay pagos registrados";
  const inactiveEmptyMessage =
    variant === "extra"
      ? "Esta reserva no tiene cobros extra registrados."
      : "Esta reserva no tiene pagos registrados.";

  // Orden por urgencia de cobro: sin esto el pago mas atrasado podia quedar
  // ultimo, debajo de un KPI que anunciaba que habia vencidos.
  const sorted = sortByDueDate(payments);

  return (
    /* Silueta de tabla del sistema (DESIGN.md: `rounded-md border border-t-2
       border-t-primary border-border bg-card`). Esta lista es inequivocamente una
       tabla —registros repetidos con identidad, monto, estado y acciones— y era la
       unica del producto sin el acento, asi que Verdigris no aparecia en la columna
       que hace el trabajo de la pagina. El acento va SOLO cuando hay filas: un
       accent strip de marca coronando un contenedor vacio senala una tabla que no
       existe. */
    <div
      className={cn(
        "rounded-md border border-border bg-card overflow-hidden",
        sorted.length > 0 && "border-t-2 border-t-primary",
      )}
    >
      {/* Empty state — solo mensaje. El CTA "Agregar Pago" vive en el header de la
          sección padre (no se duplica aquí), evitando dos botones con la misma acción
          cuando la lista está vacía. El strip celebratorio "Pago cobrado · $X" fue
          eliminado: redundaba con el KPI "Pagado" del header y con el badge "Pagado"
          de cada PaymentCard. La lista queda plana, sin summary interno. */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-muted-foreground">
            {isActive ? activeEmptyMessage : inactiveEmptyMessage}
          </p>
          {/* El CTA vivia solo en el top bar. Con la lista vacia eso deja al owner
              con un mensaje y ningun camino, a ~900px del unico boton, en la
              esquina opuesta de la pantalla. */}
          {isActive && onAddPayment && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onAddPayment}>
              <Plus className="size-3.5" />
              {variant === "extra" ? "Agregar cobro extra" : "Agregar pago"}
            </Button>
          )}
        </div>
      ) : (
        <div>
          {/* El rotulo de columna, una vez. Antes cada fila reimprimia su propio
              "MONTO A PAGAR": seis copias de lo mismo en una lista de seis. */}
          <div className="hidden @2xl:flex items-center gap-4 border-b border-border bg-muted/50 px-4 py-2">
            <span className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {variant === "extra" ? "Cobro" : "Pago"}
            </span>
            <span className="shrink-0 w-[130px] text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Monto
            </span>
            <span className="shrink-0 w-[248px]" aria-hidden="true" />
          </div>
        <div className="divide-y divide-border">
          {sorted.map((payment, idx) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              index={idx}
              total={sorted.length}
              daysUntilDue={getDaysUntilDue(payment.dueDate)}
              isFirstOverdue={payment.id === firstOverdueId}
              nowKey={nowKey}
              isActive={isActive}
              onGenerateLink={onGenerateLink}
              onRegenerateLink={onRegenerateLink}
              onMarkPaid={onMarkPaid}
              onDeletePayment={onDeletePayment}
              onUploadReceipt={onUploadReceipt}
              onSendLink={onSendLink}
              generatingLinkId={generatingLinkId}
              regeneratingLinkId={regeneratingLinkId}
            />
          ))}
        </div>
        </div>
      )}
    </div>
  );
}