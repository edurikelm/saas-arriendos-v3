import { z } from "zod";

/**
 * Captador: persona a cargo del propietario que le consigue arrendatarios.
 * Ver ADR-0040.
 *
 * `defaultCommissionRate` es un PORCENTAJE, no una fracción: `10` es 10%. El
 * tope de 100 y los dos decimales calzan con `Decimal(5,2)` de la base — un
 * valor más largo lo rechazaría Postgres y no el formulario.
 *
 * El email es opcional, al revés que en `clientSchema`: a un captador se le
 * suele tener el teléfono y nada más. Un string vacío del formulario se acepta
 * acá y la acción lo guarda como `null`.
 */
export const brokerSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z
    .union([z.string().email("Email inválido"), z.literal("")])
    .optional()
    .nullable(),
  phone: z.string().optional().nullable(),
  rut: z.string().optional().nullable(),
  defaultCommissionRate: z
    .number({ invalid_type_error: "Ingresa un porcentaje" })
    .min(0, "El porcentaje no puede ser negativo")
    .max(100, "El porcentaje no puede pasar de 100")
    // Tolerancia y no igualdad exacta: `10.1 * 100` es 1010.0000000000001 en
    // punto flotante, y rechazar eso sería rechazar un porcentaje válido.
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9, {
      message: "Máximo dos decimales",
    }),
  active: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export type BrokerInput = z.infer<typeof brokerSchema>;
