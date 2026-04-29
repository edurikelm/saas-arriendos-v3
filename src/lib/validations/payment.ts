import { z } from "zod";

export const paymentSchema = z.object({
  reservationId: z.string().min(1),
  amount: z.number().positive("El monto debe ser positivo"),
  method: z.enum(["MERCADO_PAGO", "CASH", "TRANSFER"]),
});

export type PaymentInput = z.infer<typeof paymentSchema>;