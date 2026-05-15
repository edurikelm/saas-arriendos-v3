import { z } from "zod";

export const paymentSchema = z.object({
  reservationId: z.string().min(1),
  amount: z.number().positive("El monto debe ser positivo"),
  method: z.enum(["MERCADO_PAGO", "CASH", "TRANSFER"]),
  status: z.enum(["PENDING", "COMPLETED"]).optional().default("COMPLETED"),
  initPoint: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;