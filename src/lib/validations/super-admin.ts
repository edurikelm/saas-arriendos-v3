import { z } from "zod";

export const superAdminSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().min(2, "Nombre debe tener al menos 2 caracteres"),
  role: z.enum(["SUPER_ADMIN"]),
});

export type SuperAdminInput = z.infer<typeof superAdminSchema>;

export const updateUserPlanSchema = z.object({
  userId: z.string().uuid("ID de usuario inválido"),
  plan: z.enum(["FREE", "PRO"]),
});

export type UpdateUserPlanInput = z.infer<typeof updateUserPlanSchema>;