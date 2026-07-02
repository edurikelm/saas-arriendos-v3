/**
 * Pure function: renders a notification intent into subject, body text, and HTML.
 *
 * title and body are snapshots (stored at creation time, never derived later).
 * This function generates those snapshots given a NotificationIntent and a format.
 *
 * Used by both InAppChannel (title/body stored) and EmailChannel (subject/html/text).
 */

export type NotificationEventType =
  | "RESERVATION_CREATED"
  | "RESERVATION_CANCELLED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_REVERTED"
  | "PAYMENT_REMINDER"
  | "PAYMENT_FAILED";

export interface RenderedNotification {
  subject: string;
  html: string;
  text: string;
}

export interface NotificationRenderData {
  type: NotificationEventType;
  // Common
  clientName?: string;
  propertyName?: string;
  reservationId?: string;
  paymentId?: string;
  amount?: string;
  milestone?: string;
  // For PAYMENT_REMINDER
  dueDate?: string;
  daysFromToday?: number;
  // For PAYMENT_REVERTED
  reason?: string;
}

/**
 * Renders a notification into subject + body for the given format.
 */
export function renderNotification(
  data: NotificationRenderData,
  format: "in-app" | "email" = "email",
): RenderedNotification {
  const { type } = data;

  switch (type) {
    case "RESERVATION_CREATED":
      return renderReservationCreated(data, format);
    case "RESERVATION_CANCELLED":
      return renderReservationCancelled(data, format);
    case "PAYMENT_RECEIVED":
      return renderPaymentReceived(data, format);
    case "PAYMENT_REMINDER":
      return renderPaymentReminder(data, format);
    case "PAYMENT_REVERTED":
      return renderPaymentReverted(data, format);
    case "PAYMENT_FAILED":
      return renderPaymentFailed(data, format);
    default:
      return {
        subject: "Notificación RentalPro",
        html: `<p>${data.type}</p>`,
        text: data.type,
      };
  }
}

function renderReservationCreated(
  data: NotificationRenderData,
  format: "in-app" | "email",
): RenderedNotification {
  const clientName = data.clientName ?? "un cliente";
  const propertyName = data.propertyName ?? "una propiedad";
  const subject = `Nueva reserva: ${clientName} en ${propertyName}`;
  const bodyText = `Se creó una nueva reserva para ${clientName} en ${propertyName}.`;
  const link = data.reservationId ? `/reservations/${data.reservationId}` : undefined;

  return buildRendered(subject, bodyText, link, format);
}

function renderReservationCancelled(
  data: NotificationRenderData,
  format: "in-app" | "email",
): RenderedNotification {
  const clientName = data.clientName ?? "un cliente";
  const propertyName = data.propertyName ?? "una propiedad";
  const subject = `Reserva cancelada: ${clientName} en ${propertyName}`;
  const bodyText = `La reserva de ${clientName} en ${propertyName} fue cancelada.`;
  const link = data.reservationId ? `/reservations/${data.reservationId}` : undefined;

  return buildRendered(subject, bodyText, link, format);
}

function renderPaymentReceived(
  data: NotificationRenderData,
  format: "in-app" | "email",
): RenderedNotification {
  const clientName = data.clientName ?? "un cliente";
  const amount = data.amount ?? "—";
  const subject = `Pago recibido: ${clientName} (${amount})`;
  const bodyText = `Se registró un pago de ${amount} de ${clientName}.`;
  const link = data.paymentId ? `/payments/${data.paymentId}` : undefined;

  return buildRendered(subject, bodyText, link, format);
}

function renderPaymentReminder(
  data: NotificationRenderData,
  format: "in-app" | "email",
): RenderedNotification {
  const clientName = data.clientName ?? "un cliente";
  const amount = data.amount ?? "—";
  const milestone = data.milestone ?? "";
  const dueDate = data.dueDate ?? "";

  let subject: string;
  let bodyText: string;

  if (data.daysFromToday !== undefined) {
    if (data.daysFromToday === 0) {
      subject = ` Recordatorio: pago vence hoy — ${clientName} (${amount})`;
      bodyText = `El pago de ${amount} de ${clientName} vence hoy${dueDate ? ` (${dueDate})` : ""}.`;
    } else if (data.daysFromToday > 0) {
      subject = `Recordatorio: pago en ${data.daysFromToday} días — ${clientName} (${amount})`;
      bodyText = `El pago de ${amount} de ${clientName} vence en ${data.daysFromToday} día${data.daysFromToday > 1 ? "s" : ""}.`;
    } else {
      subject = `Pago vencido hace ${Math.abs(data.daysFromToday)} días — ${clientName} (${amount})`;
      bodyText = `El pago de ${amount} de ${clientName} está vencido desde hace ${Math.abs(data.daysFromToday)} día${Math.abs(data.daysFromToday) > 1 ? "s" : ""}.`;
    }
  } else {
    subject = `Recordatorio de pago: ${clientName} (${amount})`;
    bodyText = `Recordatorio: el pago de ${amount} de ${clientName} (${milestone}).`;
  }

  const link = data.paymentId ? `/payments/${data.paymentId}` : undefined;
  return buildRendered(subject, bodyText, link, format);
}

function renderPaymentFailed(
  data: NotificationRenderData,
  format: "in-app" | "email",
): RenderedNotification {
  const clientName = data.clientName ?? "un cliente";
  const amount = data.amount ?? "—";
  const subject = `Pago fallido: ${clientName} (${amount})`;
  const bodyText = `El pago de ${amount} de ${clientName} no pudo procesarse.`;
  const link = data.paymentId ? `/payments/${data.paymentId}` : undefined;

  return buildRendered(subject, bodyText, link, format);
}

function renderPaymentReverted(
  data: NotificationRenderData,
  format: "in-app" | "email",
): RenderedNotification {
  const clientName = data.clientName ?? "un cliente";
  const amount = data.amount ?? "—";
  const subject = `Pago revertido: ${clientName} (${amount})`;
  const bodyText = `Se revirtió el pago de ${amount} de ${clientName}.${data.reason ? ` Motivo: ${data.reason}.` : ""}`;
  const link = data.paymentId ? `/payments/${data.paymentId}` : undefined;
  return buildRendered(subject, bodyText, link, format);
}

function buildRendered(
  subject: string,
  bodyText: string,
  link: string | undefined,
  format: "in-app" | "email",
): RenderedNotification {
  if (format === "in-app") {
    return {
      subject,
      html: bodyText,
      text: bodyText,
    };
  }

  const linkHtml = link
    ? `<p><a href="${link}">Ver detalles en RentalPro</a></p>`
    : "";
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333;">${subject}</h2>
  <p>${bodyText}</p>
  ${linkHtml}
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #888; font-size: 12px;">
    Enviado por RentalPro · Notificaciones de negocio
  </p>
</body>
</html>`.trim();

  return { subject, html, text: bodyText };
}
