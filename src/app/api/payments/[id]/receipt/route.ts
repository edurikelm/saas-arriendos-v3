import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPaymentReceiptData } from "@/lib/payments/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { PaymentReceipt } from "@/lib/payments/receipt-pdf";

const RECEIPTS_BUCKET =
  process.env.SUPABASE_PAYMENT_RECEIPTS_BUCKET || "payment-receipts";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // 2. Load payment
  const { id: paymentId } = await params;
  const payment = await getPaymentReceiptData(paymentId);

  if (!payment) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  // 3. Authorization: payment belongs to the owner
  if (payment.reservation.userId !== session.userId) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  // 4. Validate payment is COMPLETED
  if (payment.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Solo se puede generar comprobante para pagos completados" },
      { status: 400 }
    );
  }

  // 5. Validate method is MERCADO_PAGO
  if (payment.method !== "MERCADO_PAGO") {
    return NextResponse.json(
      { error: "Comprobante PDF disponible solo para pagos con Mercado Pago" },
      { status: 400 }
    );
  }

  // 6. Build deterministic storage path
  const paidAtUnix = payment.paidAt
    ? Math.floor(new Date(payment.paidAt).getTime() / 1000)
    : Math.floor(Date.now() / 1000);
  const filePath = `payments/${paymentId}/${paymentId}-${paidAtUnix}.pdf`;

  // 7. Check if PDF already exists in storage
  const supabase = createAdminClient();

  // Try to get signed URL directly — if file exists this works
  const existingSigned = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(filePath, 60 * 5);

  if (!existingSigned.error && existingSigned.data?.signedUrl) {
    // PDF already exists — redirect to signed URL
    return NextResponse.redirect(existingSigned.data.signedUrl, { status: 302 });
  }

  // 8. Generate PDF
  let buffer: Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(
      React.createElement(PaymentReceipt, { payment, paidAtUnix }) as React.ReactElement<any>
    );
    buffer = Buffer.from(pdfBuffer);
  } catch (err) {
    console.error("Error rendering PDF:", err);
    return NextResponse.json(
      { error: "Error al generar el comprobante PDF" },
      { status: 500 }
    );
  }

  // 9. Upload to Supabase Storage
  const upload = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(filePath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (upload.error) {
    console.error("Error uploading PDF:", upload.error);
    return NextResponse.json(
      { error: "Error al subir el comprobante PDF" },
      { status: 500 }
    );
  }

  // 10. Generate signed URL and redirect
  const signed = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(filePath, 60 * 5);

  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json(
      { error: "No se pudo generar URL firmada" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signed.data.signedUrl, { status: 302 });
}
