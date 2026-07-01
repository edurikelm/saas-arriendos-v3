import { z } from "zod";

export const externalChannelSchema = z.enum(["AIRBNB", "BOOKING_COM", "VRBO", "OTHER"]);

export const createExternalCalendarInputSchema = z.object({
  propertyId: z.string().min(1),
  channel: externalChannelSchema,
  name: z.string().min(1, "El nombre no puede estar vacío").max(100, "El nombre no puede exceder 100 caracteres"),
  feedUrl: z.string().url("URL de feed inválida").refine((u) => u.startsWith("https://"), {
    message: "La URL del feed debe usar HTTPS",
  }),
});

export const updateExternalCalendarInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "El nombre no puede estar vacío").max(100, "El nombre no puede exceder 100 caracteres").optional(),
  feedUrl: z.string().url("URL de feed inválida").refine((u) => u.startsWith("https://"), {
    message: "La URL del feed debe usar HTTPS",
  }).optional(),
  isActive: z.boolean().optional(),
});

export const syncExternalCalendarInputSchema = z.object({
  id: z.string().min(1),
});

export type CreateExternalCalendarInput = z.infer<typeof createExternalCalendarInputSchema>;
export type UpdateExternalCalendarInput = z.infer<typeof updateExternalCalendarInputSchema>;
export type SyncExternalCalendarInput = z.infer<typeof syncExternalCalendarInputSchema>;
