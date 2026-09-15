"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MarkPaidDialog } from "@/components/dashboard/mark-paid-dialog";
import { RegisterPaymentDialog } from "@/components/dashboard/register-payment-dialog";
import { SendPaymentLinkDialog } from "@/components/reservations/send-payment-link-dialog";
import {
  generateMercadoPagoLink,
  generatePaymentLink,
  regeneratePaymentLink,
} from "@/lib/actions/payments";
import type { DashboardNextCharge } from "@/lib/dashboard/summary";

type ExistingCharge = Extract<DashboardNextCharge, { kind: "EXISTING" }>;

/** Payload mínimo que espera `SendPaymentLinkDialog` (ver su interfaz `Payment`). */
interface SendPaymentLinkPayload {
  id: string;
  amount: string;
  initPoint: string | null;
  status: string;
  method: string;
  dueDate: string | null;
  installmentIndex: number | null;
  title: string | null;
}

const NOTICE_ACTIVE_MP_LINK =
  "Este cobro tiene un link de Mercado Pago vigente. Si el cliente también lo paga, se cobra dos veces.";

/** `true` si el pago sigue teniendo un link utilizable: existe y no venció. */
function hasActiveLink(charge: ExistingCharge, now: Date): boolean {
  if (!charge.initPoint) return false;
  if (!charge.expiresAt) return true;
  return new Date(charge.expiresAt) > now;
}

/**
 * Elegibilidad de "Enviar link" para un `EXISTING`: mismos hechos que la
 * matriz de `PaymentRowActions` (status/method/initPoint/expiresAt), pero acá
 * un solo botón cubre generar, regenerar y reenviar. Se excluye únicamente
 * "FAILED con link vigente": ese cobro no va a prosperar por ese link y el
 * servidor tampoco ofrece una acción sobre él (`generatePaymentLink` exige
 * PENDING, `regeneratePaymentLink` exige que no haya link vigente).
 */
function canOfferSendLink(nextCharge: DashboardNextCharge, now: Date): boolean {
  if (nextCharge.kind === "NEW") return true;
  if (nextCharge.method !== "MERCADO_PAGO") return false;
  return !(nextCharge.status === "FAILED" && hasActiveLink(nextCharge, now));
}

/**
 * Etiqueta del cobro para el `contextLabel` de `MarkPaidDialog`. Cuota con su
 * total si se conoce, cobro extra por su título (o el genérico), y "Arriendo"
 * para el resto — nunca "cuota" en un DAILY, que no tiene.
 */
function chargeLabel(charge: ExistingCharge): string {
  if (charge.installmentIndex != null) {
    const base = `Cuota ${charge.installmentIndex}`;
    return charge.installmentCount != null ? `${base} de ${charge.installmentCount}` : base;
  }
  if (charge.paymentType === "EXTRA") {
    return charge.title || "Cobro extra";
  }
  return "Arriendo";
}

/** Identidad del cobro: el mismo pago, o "el saldo sin cobro" de esta reserva. */
function chargeKey(charge: DashboardNextCharge | null): string | null {
  if (!charge) return null;
  return charge.kind === "NEW" ? "new" : `existing:${charge.paymentId}`;
}

function toSendPayload(charge: ExistingCharge): SendPaymentLinkPayload {
  return {
    id: charge.paymentId,
    amount: String(charge.amount),
    initPoint: charge.initPoint,
    status: charge.status,
    method: charge.method,
    dueDate: charge.dueDate,
    installmentIndex: charge.installmentIndex,
    title: charge.title,
  };
}

export interface CobranzaRowActionsProps {
  reservationId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  propertyName: string;
  billingType: "DAILY" | "MONTHLY";
  nextCharge: DashboardNextCharge | null;
  /** MP conectado y con la sección habilitada. Sin esto, "Enviar link" nunca aparece. */
  canSendPaymentLinks?: boolean;
}

/**
 * Acciones de la fila de "Por cobrar" (Nivel 3, ADR-0017): "Registrar pago" y
 * "Enviar link", compuestas sobre las server actions existentes de
 * `@/lib/actions/payments` — este archivo no agrega ninguna regla financiera
 * nueva, solo decide CUÁL de las ya existentes llamar según `nextCharge`.
 *
 * Sin `nextCharge` no hay nada que hacer sobre esta reserva: no renderiza
 * nada (no es una fila sin acciones con un guion, es una fila sin botones).
 */
export function CobranzaRowActions({
  reservationId,
  clientName,
  clientEmail,
  clientPhone,
  propertyName,
  billingType,
  nextCharge,
  canSendPaymentLinks = false,
}: CobranzaRowActionsProps) {
  const router = useRouter();
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [sendLinkLoading, setSendLinkLoading] = useState(false);
  const [sendPayload, setSendPayload] = useState<SendPaymentLinkPayload | null>(null);

  // Link generado en esta fila, recordado por cobro. `router.refresh()` tarda:
  // entre que el servidor crea el link y que llegan las props nuevas, la fila
  // sigue viendo el `nextCharge` viejo (NEW, o EXISTING sin `initPoint`). Si en
  // esa ventana se cierra el diálogo y se vuelve a pulsar, sin este recuerdo se
  // llamaría al servidor otra vez: con NEW, `generateMercadoPagoLink` crearía un
  // SEGUNDO pago PENDING por el mismo saldo, porque no revisa si ya existe uno;
  // con EXISTING, una segunda preferencia sobre el mismo pago.
  const [generated, setGenerated] = useState<{
    key: string;
    payload: SendPaymentLinkPayload;
  } | null>(null);

  // Cuando el cobro de la fila cambia de identidad (llegó el refresh, o el pago
  // se borró en otra pestaña y la fila volvió a NEW), el link recordado deja de
  // aplicar: reabrirlo mandaría el link de un cobro que ya no es este. Se ajusta
  // durante el render, no en un efecto, para no pintar un frame con el dato viejo.
  const currentKey = chargeKey(nextCharge);
  const [trackedKey, setTrackedKey] = useState(currentKey);
  if (trackedKey !== currentKey) {
    setTrackedKey(currentKey);
    setGenerated(null);
  }

  if (!nextCharge) return null;

  const showSendLink = canSendPaymentLinks && canOfferSendLink(nextCharge, new Date());

  function handleRegisterPaymentClick() {
    if (nextCharge!.kind === "EXISTING") {
      setMarkPaidOpen(true);
    } else {
      setRegisterOpen(true);
    }
  }

  async function handleSendLinkClick() {
    const charge = nextCharge!;
    const key = chargeKey(charge)!;

    if (generated?.key === key) {
      setSendPayload(generated.payload);
      return;
    }

    if (charge.kind === "NEW") {
      setSendLinkLoading(true);
      try {
        const result = await generateMercadoPagoLink(reservationId);
        // `result.payment` no está tipado como requerido en la rama de
        // éxito (el return type de `generateMercadoPagoLink` no es un
        // discriminated union), así que se guarda explícito además de
        // `result.error` — nunca debería faltar si no hubo error.
        if (result.error || !result.payment) {
          toast.error(result.error ?? "Error al generar el link de pago");
          return;
        }
        const payload: SendPaymentLinkPayload = {
          id: result.payment.id,
          amount: String(result.payment.amount),
          initPoint: result.initPoint ?? null,
          status: "PENDING",
          method: "MERCADO_PAGO",
          dueDate: null,
          installmentIndex: null,
          title: null,
        };
        setGenerated({ key, payload });
        setSendPayload(payload);
      } catch {
        toast.error("Error al generar el link de pago");
      } finally {
        setSendLinkLoading(false);
        // El dato pudo cambiar en otra pestaña — refrescar tanto en éxito
        // como en error mantiene el resto del tablero consistente.
        router.refresh();
      }
      return;
    }

    if (hasActiveLink(charge, new Date())) {
      // Link PENDING vigente: no hay nada que generar, se abre directo.
      setSendPayload(toSendPayload(charge));
      return;
    }

    setSendLinkLoading(true);
    try {
      // PENDING sin link → generar. Cualquier otro caso elegible acá (link
      // vencido de cualquier estado, o FAILED sin link) → regenerar. Mismas
      // condiciones que exige el servidor, así ningún click termina en un
      // error garantizado.
      const result =
        charge.status === "PENDING" && !charge.initPoint
          ? await generatePaymentLink(charge.paymentId)
          : await regeneratePaymentLink(charge.paymentId);

      if (result.error) {
        toast.error(result.error);
        return;
      }
      const payload = { ...toSendPayload(charge), initPoint: result.initPoint ?? null };
      setGenerated({ key, payload });
      setSendPayload(payload);
    } catch {
      toast.error("Error al generar el link de pago");
    } finally {
      setSendLinkLoading(false);
      router.refresh();
    }
  }

  const existingCharge = nextCharge.kind === "EXISTING" ? nextCharge : null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Registrar pago de ${clientName}`}
        title={`Registrar pago de ${clientName}`}
        onClick={handleRegisterPaymentClick}
      >
        <Check className="size-3.5" />
      </Button>

      {showSendLink && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Enviar link de pago a ${clientName}`}
          title={`Enviar link de pago a ${clientName}`}
          disabled={sendLinkLoading}
          onClick={handleSendLinkClick}
        >
          {sendLinkLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
        </Button>
      )}

      {/* Diálogos lazy: montados solo mientras están abiertos. Con dos tipos
          de diálogo posibles para "Registrar pago" (Mark vs Register) según
          `nextCharge.kind`, no hay un valor "apagado" limpio para mantenerlos
          siempre montados como hace `MarkPaidDialog` en `/payments`. */}
      {existingCharge && markPaidOpen && (
        <MarkPaidDialog
          paymentId={existingCharge.paymentId}
          amount={existingCharge.amount}
          defaultMethod={existingCharge.method}
          contextLabel={`${clientName} · ${propertyName} · ${chargeLabel(existingCharge)}`}
          notice={
            existingCharge.method === "MERCADO_PAGO" && hasActiveLink(existingCharge, new Date())
              ? NOTICE_ACTIVE_MP_LINK
              : undefined
          }
          open={markPaidOpen}
          onOpenChange={setMarkPaidOpen}
          onSuccess={() => {
            setMarkPaidOpen(false);
            router.refresh();
          }}
          // Un rechazo casi siempre significa que la fila quedó vieja (el pago se
          // completó o se borró en otra pestaña): sin refrescar, cada reintento
          // repetiría el mismo error hasta recargar la página.
          onError={() => router.refresh()}
        />
      )}

      {nextCharge.kind === "NEW" && registerOpen && (
        <RegisterPaymentDialog
          reservationId={reservationId}
          maxAmount={nextCharge.amount}
          contextLabel={`${clientName} · ${propertyName} · Saldo del arriendo`}
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          onSuccess={() => {
            setRegisterOpen(false);
            router.refresh();
          }}
          onError={() => router.refresh()}
        />
      )}

      {/* Su mensaje se inicializa desde props en el primer render — por eso
          monta solo cuando ya hay `initPoint`, nunca antes con un payload vacío. */}
      {sendPayload && (
        <SendPaymentLinkDialog
          open
          onOpenChange={(next) => {
            if (!next) setSendPayload(null);
          }}
          payment={sendPayload}
          client={{ name: clientName, email: clientEmail, phone: clientPhone ?? undefined }}
          propertyName={propertyName}
          billingType={billingType}
        />
      )}
    </>
  );
}
