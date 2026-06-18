import { z } from "zod";

export const ticketPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const ticketCategoryEnum = z.enum(["RESERVATIONS", "PAYMENTS", "PROPERTIES", "ACCOUNT", "OTHER"]);
export const affectedEntityTypeEnum = z.enum(["RESERVATION", "PAYMENT", "PROPERTY"]);

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

const imageFileNameRegex = /\.(jpg|jpeg|png|webp)$/i;

export const supportAttachmentSchema = z.object({
  url: z.string().url("URL de imagen inválida"),
  fileName: z.string().regex(imageFileNameRegex, "Solo se permiten imágenes JPG, PNG o WebP"),
  fileSize: z.number().max(5 * 1024 * 1024, "La imagen no puede superar los 5MB"),
});

export const supportTicketSchema = z.object({
  subject: z.string().min(5, "El asunto debe tener al menos 5 caracteres").max(120, "El asunto no puede exceder 120 caracteres"),
  description: z.string().min(20, "La descripción debe tener al menos 20 caracteres").max(2000, "La descripción no puede exceder 2000 caracteres"),
  priority: ticketPriorityEnum,
  category: ticketCategoryEnum,
  images: z.array(supportAttachmentSchema).max(3, "Máximo 3 imágenes por mensaje").optional(),
  affectedEntityType: affectedEntityTypeEnum.optional(),
  affectedEntityId: z.string().min(1, "ID de entidad requerido").optional(),
}).refine(
  (data) => {
    if (data.affectedEntityType && !data.affectedEntityId) return false;
    if (!data.affectedEntityType && data.affectedEntityId) return false;
    return true;
  },
  { message: "affectedEntityType y affectedEntityId deben ir juntos" }
);

export type SupportTicketInput = z.infer<typeof supportTicketSchema>;

export const supportMessageSchema = z.object({
  content: z.string().min(1, "El mensaje no puede estar vacío").max(2000, "El mensaje no puede exceder 2000 caracteres"),
  images: z.array(supportAttachmentSchema).max(3, "Máximo 3 imágenes por mensaje").optional(),
});

export type SupportMessageInput = z.infer<typeof supportMessageSchema>;
export type AttachmentInput = z.infer<typeof supportAttachmentSchema>;
