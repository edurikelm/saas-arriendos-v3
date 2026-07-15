/**
 * Password reset email sender via Resend.
 *
 * Sends a password reset email containing a single-use link with the raw token.
 * The token is shown ONCE in this email and never persisted in plain text;
 * only its SHA-256 hash lives in the database (see PasswordResetToken model).
 *
 * Idempotent: if RESEND_API_KEY or RESEND_FROM_EMAIL are not configured,
 * the function returns `{ sent: false, reason: "no-api-key" }` without
 * calling Resend. This mirrors the behavior of the notification email channel
 * (see email-channel.ts) and keeps local development unblocked.
 *
 * Note: unlike notification emails, this sender does NOT check
 * `notificationsEmailEnabled`. A user who explicitly requested a password
 * reset must always receive the email, otherwise they can never recover
 * their account.
 */

import { Resend } from "resend";

export type SendPasswordResetEmailParams = {
  to: string;
  resetUrl: string;
  expirationMinutes?: number;
};

export type SendPasswordResetEmailResult =
  | { sent: true; emailId: string }
  | { sent: false; reason: "no-api-key" }
  | { sent: false; reason: "resend-error"; error: string }
  | { sent: false; reason: "exception"; error: string };

const EXPIRATION_MINUTES = 60;

function buildEmailContent(resetUrl: string, expirationMinutes: number) {
  const subject = "Restablecer tu contraseña de RentalPro";
  const text = [
    "Recibimos una solicitud para restablecer la contraseña de tu cuenta en RentalPro.",
    "",
    `Para continuar, abre este enlace (válido por ${expirationMinutes} minutos):`,
    resetUrl,
    "",
    "Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual seguirá siendo válida.",
    "",
    "— Equipo RentalPro",
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px; font-weight: 600; color: #0f172a; margin: 0 0 16px;">Restablecer contraseña</h1>
      <p style="font-size: 14px; line-height: 1.5; color: #334155; margin: 0 0 16px;">
        Recibimos una solicitud para restablecer la contraseña de tu cuenta en RentalPro.
      </p>
      <p style="font-size: 14px; line-height: 1.5; color: #334155; margin: 0 0 24px;">
        Haz clic en el siguiente botón para crear una nueva contraseña. El enlace es válido por ${expirationMinutes} minutos.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2DBE85; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
          Restablecer contraseña
        </a>
      </p>
      <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin: 0 0 8px;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:
      </p>
      <p style="font-size: 12px; line-height: 1.4; color: #64748b; word-break: break-all; margin: 0 0 16px;">
        ${resetUrl}
      </p>
      <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin: 0;">
        Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual seguirá siendo válida.
      </p>
    </div>
  `;

  return { subject, text, html };
}

export async function sendPasswordResetEmail(
  params: SendPasswordResetEmailParams,
): Promise<SendPasswordResetEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const fromName = process.env.RESEND_FROM_NAME ?? "RentalPro";

  if (!apiKey || !fromEmail) {
    console.log(
      `[password-reset] No API key/from. Skipping. to=${params.to} url=${params.resetUrl}`,
    );
    return { sent: false, reason: "no-api-key" };
  }

  const expirationMinutes = params.expirationMinutes ?? EXPIRATION_MINUTES;
  const { subject, text, html } = buildEmailContent(params.resetUrl, expirationMinutes);

  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: params.to,
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error(
        `[password-reset] Resend API error. to=${params.to}`,
        result.error,
      );
      return { sent: false, reason: "resend-error", error: result.error.message ?? "Resend API error" };
    }

    return { sent: true, emailId: result.data?.id ?? "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Resend error";
    console.error(`[password-reset] Send failed. to=${params.to}`, message);
    return { sent: false, reason: "exception", error: message };
  }
}
