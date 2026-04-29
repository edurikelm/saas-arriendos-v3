import { z } from "zod";

export const propertySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  type: z.enum(["HOUSE", "APARTMENT", "CABIN", "HOSTEL", "HOTEL", "OFFICE", "COMMERCIAL"]),
  unitsAvailable: z.number().min(1, "Debe haber al menos 1 unidad"),
  dailyPrice: z.number().positive("El precio debe ser positivo"),
  monthlyPrice: z.number().positive("El precio debe ser positivo").optional().nullable(),
  currency: z.string().default("CLP"),
  amenities: z.array(z.string()).default([]),
  color: z.string().default("#3B82F6"),
  mainImage: z.string().optional().nullable(),
  images: z.array(z.string()).default([]),
});

export type PropertyInput = z.infer<typeof propertySchema>;