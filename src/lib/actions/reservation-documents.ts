"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createReservationDocumentInputSchema,
  RESERVATION_DOCUMENT_MAX_FILES,
  reservationDocumentFileSchema,
  type ReservationDocumentCategoryInput,
} from "@/lib/validations/reservation-document";

const STORAGE_BUCKET = process.env.SUPABASE_RESERVATION_DOCS_BUCKET || "reservation-documents";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveDocumentType(mimeType: string): "PDF" | "JPG" | "PNG" | "WEBP" {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "image/png") return "PNG";
  if (mimeType === "image/webp") return "WEBP";
  return "JPG";
}

async function getAuthorizedMonthlyReservation(reservationId: string, userId: string) {
  return prisma.reservation.findFirst({
    where: {
      id: reservationId,
      userId,
      billingType: "MONTHLY",
    },
    select: { id: true, billingType: true },
  });
}

export async function listReservationDocuments(reservationId: string) {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };

  const reservation = await getAuthorizedMonthlyReservation(reservationId, session.userId);
  if (!reservation) return { error: "Reserva mensual no encontrada" };

  const documents = await prisma.reservationDocument.findMany({
    where: { reservationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return { documents };
}

export async function createReservationDocument(input: {
  reservationId: string;
  category: ReservationDocumentCategoryInput;
  file: File;
}) {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };
  if (session.plan !== "PRO") return { error: "Funcionalidad disponible solo para plan PRO" };

  const parsedInput = createReservationDocumentInputSchema.safeParse({
    reservationId: input.reservationId,
    category: input.category,
  });
  if (!parsedInput.success) return { error: parsedInput.error.issues[0]?.message || "Datos inválidos" };

  const parsedFile = reservationDocumentFileSchema.safeParse({
    name: input.file.name,
    size: input.file.size,
    type: input.file.type,
  });
  if (!parsedFile.success) return { error: parsedFile.error.issues[0]?.message || "Archivo inválido" };

  const reservation = await getAuthorizedMonthlyReservation(parsedInput.data.reservationId, session.userId);
  if (!reservation) return { error: "Reserva mensual no encontrada" };

  const count = await prisma.reservationDocument.count({
    where: { reservationId: parsedInput.data.reservationId, deletedAt: null },
  });
  if (count >= RESERVATION_DOCUMENT_MAX_FILES) {
    return { error: `Máximo ${RESERVATION_DOCUMENT_MAX_FILES} documentos por reserva` };
  }

  const supabase = createAdminClient();
  const safeName = sanitizeFileName(parsedFile.data.name);
  const path = `${session.userId}/${parsedInput.data.reservationId}/${Date.now()}-${safeName}`;
  const buffer = await input.file.arrayBuffer();

  const upload = await supabase.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: parsedFile.data.type,
    upsert: false,
  });

  if (upload.error) {
    return { error: "No se pudo subir el documento" };
  }

  const document = await prisma.reservationDocument.create({
    data: {
      reservationId: parsedInput.data.reservationId,
      category: parsedInput.data.category,
      documentType: resolveDocumentType(parsedFile.data.type),
      fileName: parsedFile.data.name,
      filePath: path,
      fileSize: parsedFile.data.size,
      mimeType: parsedFile.data.type,
    },
  });

  revalidatePath("/reservations");
  return { success: true, document };
}

export async function getReservationDocumentSignedUrl(documentId: string) {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };

  const document = await prisma.reservationDocument.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
      reservation: {
        userId: session.userId,
      },
    },
    include: { reservation: { select: { billingType: true } } },
  });

  if (!document || document.reservation.billingType !== "MONTHLY") {
    return { error: "Documento no encontrado" };
  }

  const supabase = createAdminClient();
  const signed = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(document.filePath, 60 * 5);
  if (signed.error || !signed.data?.signedUrl) {
    return { error: "No se pudo generar URL firmada" };
  }

  return { url: signed.data.signedUrl };
}

export async function softDeleteReservationDocument(documentId: string) {
  const session = await getSession();
  if (!session) return { error: "No autenticado" };

  const document = await prisma.reservationDocument.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
      reservation: {
        userId: session.userId,
      },
    },
    include: { reservation: { select: { billingType: true } } },
  });

  if (!document || document.reservation.billingType !== "MONTHLY") {
    return { error: "Documento no encontrado" };
  }

  await prisma.reservationDocument.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/reservations");
  return { success: true };
}
