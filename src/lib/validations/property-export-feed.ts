import { z } from "zod";
import { externalChannelSchema } from "./external-calendar";

export const createPropertyExportFeedInputSchema = z.object({
  propertyId: z.string().min(1, "El ID de propiedad es requerido"),
  channel: externalChannelSchema,
});

export const regeneratePropertyExportFeedInputSchema = z.object({
  propertyId: z.string().min(1, "El ID de propiedad es requerido"),
  channel: externalChannelSchema,
});

export const revokePropertyExportFeedInputSchema = z.object({
  propertyId: z.string().min(1, "El ID de propiedad es requerido"),
  channel: externalChannelSchema,
});

export type CreatePropertyExportFeedInput = z.infer<typeof createPropertyExportFeedInputSchema>;
export type RegeneratePropertyExportFeedInput = z.infer<typeof regeneratePropertyExportFeedInputSchema>;
export type RevokePropertyExportFeedInput = z.infer<typeof revokePropertyExportFeedInputSchema>;
