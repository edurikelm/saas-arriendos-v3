import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
  email: z.string().email("Email inválido"),
  phone: z.string().max(30).optional().nullable(),
  companyName: z.string().max(100).optional().nullable(),
  companyRut: z.string().max(20).optional().nullable(),
  companyAddress: z.string().max(200).optional().nullable(),
  language: z.enum(["es", "en"]),
  currency: z.enum(["CLP", "USD"]),
  timezone: z.enum(["America/Santiago", "America/Lima"]),
});

export type ProfileInput = z.infer<typeof profileSchema>;
