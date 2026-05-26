import { z } from "zod";

const baseSchema = z.object({
  reservationId: z.string().min(1),
  amount: z.number().positive("El monto debe ser positivo"),
  method: z.enum(["MERCADO_PAGO", "CASH", "TRANSFER"]),
  status: z.enum(["PENDING", "COMPLETED"]).optional().default("COMPLETED"),
  initPoint: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional(),
  receiptUrl: z.string().url().optional(),
  paymentType: z.enum(["RESERVATION", "EXTRA"]).optional().default("RESERVATION"),
  title: z.string().optional(),
  description: z.string().optional(),
});

export const paymentSchema = baseSchema.refine(
  (data) => {
    if (data.paymentType === "EXTRA" && !data.title) {
      return false;
    }
    return true;
  },
  {
    message: "El título es requerido para pagos extra",
    path: ["title"],
  },
);

export type PaymentInput = z.infer<typeof paymentSchema>;