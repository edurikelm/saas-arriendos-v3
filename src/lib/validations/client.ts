import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional().nullable(),
  rut: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ClientInput = z.infer<typeof clientSchema>;