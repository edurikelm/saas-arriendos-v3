import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { mapPaymentResultState } from "@/lib/payment/result-state";

export const metadata = {
  title: "Resultado de pago",
};

type PageProps = {
  searchParams: Promise<{
    paymentId?: string;
    status?: string;
    collection_status?: string;
  }>;
};

export default async function PaymentResultPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const paymentId = params.paymentId ?? "";

  const payment = paymentId
    ? await prisma.payment.findFirst({
        where: { id: paymentId, deletedAt: null },
        select: { id: true, status: true, reservationId: true },
      })
    : null;

  const uiState = mapPaymentResultState({
    hasPaymentIdHint: Boolean(paymentId),
    internalStatus: payment?.status ?? null,
    redirectStatus: params.status,
    collectionStatus: params.collection_status,
  });

  const titleByState = {
    completed: "Pago confirmado",
    confirming: "Estamos confirmando tu pago",
    failed: "Pago no completado",
    not_found: "No pudimos identificar el pago",
  } as const;

  const messageByState = {
    completed: "Tu pago ya fue confirmado en nuestro sistema.",
    confirming: "Recibimos el retorno de Mercado Pago, pero el webhook aun esta procesando la confirmacion.",
    failed: "El pago aparece como fallido o cancelado en nuestro sistema.",
    not_found: "No se encontro un identificador de pago valido en el retorno.",
  } as const;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center px-4 py-10">
      <section className="w-full rounded-xl border border-foreground/10 bg-background p-6 ring-1 ring-foreground/10">
        <h1 className="text-2xl font-semibold">{titleByState[uiState]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{messageByState[uiState]}</p>

        {payment?.reservationId ? (
          <p className="mt-4 text-xs text-muted-foreground">Reserva asociada: {payment.reservationId}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-foreground/15 px-3 py-2 text-sm hover:bg-muted"
          >
            Ir al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
