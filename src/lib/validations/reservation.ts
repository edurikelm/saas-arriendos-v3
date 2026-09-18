import { z } from "zod";
import { commissionRateSchema } from "@/lib/validations/broker";

const dateStringSchema = z.union([
  z.string(),
  z.date()
]).transform((val, ctx) => {
  if (val instanceof Date) return val;

  let year: number, month: number, day: number;

  if (val.includes("T")) {
    const date = new Date(val);
    if (isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fecha inválida" });
      return z.NEVER;
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
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fecha inválida" });
      return z.NEVER;
    }
    return date;
  }

  ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Fecha inválida" });
  return z.NEVER;
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
  /** Quién captó la reserva. Vacío = la consiguió el propietario (ADR-0040). */
  brokerId: z.string().optional().nullable(),
  /** Se congela en la reserva al crearla. Ver ADR-0040 §2. */
  commissionRate: commissionRateSchema.optional().nullable(),
}).superRefine((data, ctx) => {
  // Con captador tiene que venir el porcentaje: una reserva con captador y sin
  // tasa no devengaría comisión y el error sería invisible hasta el reporte.
  if (data.brokerId && (data.commissionRate === null || data.commissionRate === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ingresa el porcentaje de comisión del captador",
      path: ["commissionRate"],
    });
  }

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
  brokerId: z.string().optional().nullable(),
  commissionRate: commissionRateSchema.optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.brokerId && (data.commissionRate === null || data.commissionRate === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ingresa el porcentaje de comisión del captador",
      path: ["commissionRate"],
    });
  }
});

export type ReservationInput = z.infer<typeof reservationSchema>;
export type ReservationUpdateInput = z.infer<typeof reservationUpdateSchema>;