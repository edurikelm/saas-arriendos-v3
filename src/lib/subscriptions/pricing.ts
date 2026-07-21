/**
 * Fuente única del precio PRO.
 *
 * Cualquier UI o server action que necesite el precio importa de aquí.
 * No hay magic numbers.
 *
 * Decisión (ADR-0027 §7): precio hardcoded porque cambiarlo requiere deploy.
 * Si en el futuro hay planes anuales o precios configurables desde UI, se
 * migra a una tabla `Plan` y este archivo se convierte en consumer.
 */

export const PRO_PRICING = {
  monthly: {
    amount: 9990,
    currency: "CLP",
    frequency: 1,
    frequencyType: "months",
  },
} as const;

export type ProPricing = typeof PRO_PRICING.monthly;
