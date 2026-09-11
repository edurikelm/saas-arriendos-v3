"use client";

import { useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { PaymentsTable, type Payment } from "@/components/payments/payments-table";
import type { DataTableSort } from "@/components/ui/data-table";
import { PaymentListItem } from "@/components/payments/payment-list-item";
import { PaymentsSortSelect } from "@/components/payments/payments-sort-select";
import { MarkPaidDialog } from "@/components/dashboard/mark-paid-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SendPaymentLinkDialog } from "@/components/reservations/send-payment-link-dialog";
import {
  generatePaymentLink,
  deletePayment,
  attachReceipt,
  regeneratePaymentLink,
  restorePayment,
} from "@/lib/actions/payments";

export function PaymentsTableClient({ payments }: { payments: Payment[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // <768px: mismo breakpoint que /reservations.
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null);
  const [regeneratingLinkId, setRegeneratingLinkId] = useState<string | null>(null);
  const [attachingReceiptId, setAttachingReceiptId] = useState<string | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [paymentToSend, setPaymentToSend] = useState<Payment | null>(null);

  const paymentForMarkPaid = payments.find((p) => p.id === markPaidId) ?? null;
  const markPaidLabel = paymentForMarkPaid
    ? `${paymentForMarkPaid.title || "Cobro extra"} — ${
        Number(paymentForMarkPaid.amount).toLocaleString("es-CL")
      }`
    : undefined;

  async function handleGenerateLink(paymentId: string) {
    setGeneratingLinkId(paymentId);
    try {
      const result = await generatePaymentLink(paymentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Link de pago generado");
        router.refresh();
      }
    } catch {
      toast.error("Error al generar link");
    } finally {
      setGeneratingLinkId(null);
    }
  }

  // La confirmación la hace `ConfirmDialog`, igual que el mismo borrado en el
  // detalle de reserva. Antes acá era `window.confirm`, que no toma el estilo
  // del sistema, no se puede cerrar con la tecla de escape en todos los
  // navegadores y bloquea el hilo.
  async function handleDeletePayment(paymentId: string) {
    try {
      const result = await deletePayment(paymentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Pago eliminado", {
          duration: 5000,
          action: {
            label: "Deshacer",
            onClick: async () => {
              try {
                const restoreResult = await restorePayment(paymentId);
                if ("error" in restoreResult) {
                  toast.error(restoreResult.error);
                } else if (restoreResult.restored) {
                  toast.success("Pago restaurado");
                  router.refresh();
                } else {
                  // Pago ya estaba restaurado por otro medio (otro tab, otro admin).
                  // No-op: solo refrescamos la UI por si quedó desincronizada.
                  router.refresh();
                }
              } catch {
                toast.error("Error al restaurar pago");
              }
            },
          },
        });
        router.refresh();
      }
    } catch {
      toast.error("Error al eliminar pago");
    }
  }

  async function handleRegenerateLink(paymentId: string) {
    setRegeneratingLinkId(paymentId);
    try {
      const result = await regeneratePaymentLink(paymentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Link regenerado");
        router.refresh();
      }
    } catch {
      toast.error("Error al regenerar link");
    } finally {
      setRegeneratingLinkId(null);
    }
  }

  async function handleAttachReceipt(paymentId: string) {
    setAttachingReceiptId(paymentId);
    try {
      // Open file picker
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,.pdf";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "rentalpro/receipts");

        try {
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const data = await res.json();
          if (data.error) {
            toast.error(data.error);
            return;
          }

          const result = await attachReceipt(paymentId, data.url);
          if (result.error) {
            toast.error(result.error);
            return;
          } else {
            toast.success("Comprobante adjuntado");
            router.refresh();
          }
        } catch {
          toast.error("Error al subir comprobante");
        }
      };
      input.click();
    } finally {
      setAttachingReceiptId(null);
    }
  }

  // El envío lo hace `SendPaymentLinkDialog`, el mismo del detalle de reserva:
  // plantilla editable, botón de WhatsApp y botón de correo.
  //
  // Antes acá era `navigator.share`, que en escritorio no existe en Chrome ni
  // en Firefox. Caía al portapapeles, así que el botón decía "Enviar link" y lo
  // que pasaba era una copia — y sin mensaje, sin el monto y sin el nombre del
  // cliente, que es lo que hace que el cobro se entienda al recibirlo.
  function handleSendLink(payment: Payment) {
    if (!payment.initPoint) return;
    setPaymentToSend(payment);
  }

  // El orden vive en la URL y lo resuelve el servidor, no el cliente: ordenar
  // en memoria solo reordenaría la página actual, que con 20 filas por página
  // daría un resultado que parece correcto y no lo es.
  const sortBy = searchParams.get("sortBy");
  const sortDir = searchParams.get("sortDir");
  const sort: DataTableSort | null =
    sortBy && (sortDir === "asc" || sortDir === "desc") ? { key: sortBy, dir: sortDir } : null;

  function handleSortChange(next: DataTableSort | null) {
    const params = new URLSearchParams(searchParams.toString());

    if (next) {
      params.set("sortBy", next.key);
      params.set("sortDir", next.dir);
    } else {
      // Apagar el orden es volver al por defecto del servidor, no pasar otro.
      params.delete("sortBy");
      params.delete("sortDir");
    }

    // Reordenar cambia qué filas caen en la página 1, así que volver al inicio
    // es lo único que no miente. Mismo criterio que al cambiar un filtro.
    params.delete("page");
    router.push(`/payments?${params.toString()}`);
  }

  // Los handlers son los mismos en las dos presentaciones; solo cambia el
  // layout.
  const rowHandlers = {
    onGenerateLink: handleGenerateLink,
    onRegenerateLink: handleRegenerateLink,
    onMarkPaid: setMarkPaidId,
    onDeletePayment: setPaymentToDelete,
    onAttachReceipt: handleAttachReceipt,
    onSendLink: handleSendLink,
    generatingLinkId,
    regeneratingLinkId,
    attachingReceiptId,
  };

  return (
    <>
      {isMobile ? (
        /* Filas dentro de un contenedor único, con el mismo framing que
           `DataTable` le da a la tabla en desktop. Se elige con la media query
           y no con `hidden md:block` para no montar las dos: cada fila trae
           botones, y renderizar ambas dejaba dos copias de cada acción en el
           DOM. Mismo criterio que `reservations-list-client.tsx`. */
        <div className="space-y-3">
          {/* En escritorio el orden se pide desde la cabecera de la columna;
              la lista no tiene cabeceras. */}
          <PaymentsSortSelect sort={sort} onSortChange={handleSortChange} />
          <div className="overflow-hidden rounded-md border border-t-2 border-border border-t-primary bg-card">
            {payments.map((payment) => (
              <PaymentListItem key={payment.id} payment={payment} {...rowHandlers} />
            ))}
          </div>
        </div>
      ) : (
        <PaymentsTable
          payments={payments}
          variant="full"
          sort={sort}
          onSortChange={handleSortChange}
          {...rowHandlers}
        />
      )}

      <MarkPaidDialog
        paymentId={markPaidId}
        open={markPaidId !== null}
        onOpenChange={(open) => {
          if (!open) setMarkPaidId(null);
        }}
        onSuccess={() => {
          setMarkPaidId(null);
          router.refresh();
        }}
        contextLabel={markPaidLabel}
      />

      <ConfirmDialog
        open={paymentToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPaymentToDelete(null);
        }}
        title="Eliminar pago"
        description="El pago se eliminará del registro. Podrás deshacerlo desde la notificación, inmediatamente después."
        confirmLabel="Eliminar pago"
        onConfirm={() => {
          if (!paymentToDelete) return;
          handleDeletePayment(paymentToDelete);
          setPaymentToDelete(null);
        }}
      />

      {/* Montado solo con un pago elegido: el diálogo arma el mensaje una vez,
          en el inicializador de su estado, así que si quedara montado entre
          pagos mostraría el texto del anterior. */}
      {paymentToSend && (
        <SendPaymentLinkDialog
          open
          onOpenChange={(open) => {
            if (!open) setPaymentToSend(null);
          }}
          payment={paymentToSend}
          client={{
            name: paymentToSend.clientName ?? "",
            email: paymentToSend.clientEmail ?? "",
            phone: paymentToSend.clientPhone ?? undefined,
          }}
          propertyName={paymentToSend.propertyName ?? ""}
          billingType={paymentToSend.billingType ?? "DAILY"}
        />
      )}
    </>
  );
}
