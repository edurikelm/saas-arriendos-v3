import { z } from "zod";

export const RESERVATION_DOCUMENT_MAX_FILES = 10;
export const RESERVATION_DOCUMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const reservationDocumentCategorySchema = z.enum([
  "CONTRATO",
  "ANEXO",
  "INVENTARIO",
  "OTRO",
]);

export const reservationDocumentMimeSchema = z.enum([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const reservationDocumentFileSchema = z.object({
  name: z.string().min(1, "Nombre de archivo requerido"),
  size: z.number().max(RESERVATION_DOCUMENT_MAX_SIZE_BYTES, "El archivo no puede superar los 10MB"),
  type: reservationDocumentMimeSchema,
});

export const createReservationDocumentInputSchema = z.object({
  reservationId: z.string().min(1, "Reserva inválida"),
  category: reservationDocumentCategorySchema,
});

export type ReservationDocumentCategoryInput = z.infer<typeof reservationDocumentCategorySchema>;
