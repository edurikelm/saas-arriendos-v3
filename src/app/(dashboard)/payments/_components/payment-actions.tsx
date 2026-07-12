"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PaymentsTable, type Payment } from "@/components/payments/payments-table";
import { MarkPaidDialog } from "@/components/dashboard/mark-paid-dialog";
import {
  generatePaymentLink,
  deletePayment,
  attachReceipt,
} from "@/lib/actions/payments";

export function PaymentsTableClient({ payments }: { payments: Payment[] }) {
  const router = useRouter();
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null);
  const [attachingReceiptId, setAttachingReceiptId] = useState<string | null>(null);

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

  async function handleDeletePayment(paymentId: string) {
    try {
      const result = await deletePayment(paymentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Pago eliminado");
        router.refresh();
      }
    } catch {
      toast.error("Error al eliminar pago");
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

  function handleSendLink(payment: Payment) {
    if (!payment.initPoint) return;
    const text = `Hola! Aquí está tu link de pago: ${payment.initPoint}`;
    if (navigator.share) {
      navigator
        .share({ text })
        .then(() => toast.success("Link compartido"))
        .catch(() => {
          try {
            navigator.clipboard.writeText(payment.initPoint!);
            toast.success("Link copiado al portapapeles");
          } catch {
            toast.error("No se pudo compartir el link");
          }
        });
    } else {
      try {
        navigator.clipboard.writeText(payment.initPoint!);
        toast.success("Link copiado al portapapeles");
      } catch {
        toast.error("No se pudo copiar el link");
      }
    }
  }

  return (
    <>
      <PaymentsTable
        payments={payments}
        variant="full"
        generatingLinkId={generatingLinkId}
        onGenerateLink={handleGenerateLink}
        onMarkPaid={setMarkPaidId}
        onDeletePayment={handleDeletePayment}
        onAttachReceipt={handleAttachReceipt}
        attachingReceiptId={attachingReceiptId}
        onSendLink={handleSendLink}
      />

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
    </>
  );
}
