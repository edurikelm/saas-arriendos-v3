import { z } from "zod";

const dateStringSchema = z.union([
  z.string(),
  z.date()
]).transform((val) => {
  if (val instanceof Date) return val;

  let year: number, month: number, day: number;

  if (val.includes("T")) {
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      throw new Error("Fecha inválida");
    }
    return date;
  }

  if (val.includes("-")) {
    const parts = val.split("-").map(Number);
    if (parts[0] > 31) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      day = parts[0];
      month = parts[1];
      year = parts[2];
    }
    const date = new Date(year, month - 1, day, 12, 0, 0);
    if (isNaN(date.getTime())) {
      throw new Error("Fecha inválida");
    }
    return date;
  }

  throw new Error("Fecha inválida");
});

export const reservationSchema = z.object({
  propertyId: z.string().min(1, "La propiedad es requerida"),
  clientId: z.string().min(1, "El cliente es requerido"),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  billingType: z.enum(["DAILY", "MONTHLY"]),
  unitsBooked: z.number().min(1, "Debe reservar al menos 1 unidad"),
  bookingAirbnb: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  months: z.number().optional(),
}).superRefine((data, ctx) => {
  if (data.billingType === "MONTHLY") {
    if (!data.months || data.months < 1 || data.months > 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para arriendos mensuales debe ingresar entre 1 y 12 meses",
        path: ["months"],
      });
    }
  }
});

export const reservationUpdateSchema = z.object({
  propertyId: z.string().optional(),
  clientId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  billingType: z.enum(["DAILY", "MONTHLY"]).optional(),
  unitsBooked: z.number().min(1).optional(),
  bookingAirbnb: z.boolean().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]).optional(),
  notes: z.string().optional().nullable(),
});

export type ReservationInput = z.infer<typeof reservationSchema>;
export type ReservationUpdateInput = z.infer<typeof reservationUpdateSchema>;