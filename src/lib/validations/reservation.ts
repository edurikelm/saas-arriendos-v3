import { z } from "zod";

export const reservationSchema = z.object({
  propertyId: z.string().min(1, "La propiedad es requerida"),
  clientId: z.string().min(1, "El cliente es requerido"),
  startDate: z.date(),
  endDate: z.date(),
  billingType: z.enum(["DAILY", "MONTHLY"]),
  unitsBooked: z.number().min(1, "Debe reservar al menos 1 unidad"),
  bookingAirbnb: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

export const reservationUpdateSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  unitsBooked: z.number().min(1).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]).optional(),
  notes: z.string().optional().nullable(),
});

export type ReservationInput = z.infer<typeof reservationSchema>;
export type ReservationUpdateInput = z.infer<typeof reservationUpdateSchema>;