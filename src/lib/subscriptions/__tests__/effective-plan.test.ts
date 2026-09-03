/**
 * El plan efectivo es LA regla del plan. Esta tabla es el contrato: cada fila
 * corresponde a un estado real observado en produccion o a un borde que ya
 * causo un bug.
 */

import { describe, it, expect } from "vitest";
import {
  derivePlanFromSubscription,
  resolveEffectivePlan,
} from "@/lib/subscriptions/effective-plan";

const NOW = new Date("2026-09-03T12:00:00.000Z");

/** Subscription con preapproval de MP — el caso normal. */
const sub = (status: string, currentPeriodEnd: Date | null) => ({
  status,
  currentPeriodEnd,
  mpPreapprovalId: "preapproval-123",
});
const FUTURO = new Date("2026-10-01T00:00:00.000Z");
const PASADO = new Date("2026-08-01T00:00:00.000Z");

describe("derivePlanFromSubscription", () => {
  it("sin subscription: FREE", () => {
    expect(derivePlanFromSubscription(null, NOW)).toBe("FREE");
  });

  it("AUTHORIZED con periodo futuro: PRO", () => {
    expect(
      derivePlanFromSubscription(sub("AUTHORIZED", FUTURO), NOW),
    ).toBe("PRO");
  });

  // Recien autorizada: MP todavia no devolvio las fechas. Negar PRO aca le
  // cobraria al owner sin darle el plan.
  it("AUTHORIZED sin periodo: PRO", () => {
    expect(
      derivePlanFromSubscription(sub("AUTHORIZED", null), NOW),
    ).toBe("PRO");
  });

  it("AUTHORIZED con periodo vencido: FREE (el cron no alcanzo a marcarla)", () => {
    expect(
      derivePlanFromSubscription(sub("AUTHORIZED", PASADO), NOW),
    ).toBe("FREE");
  });

  // Encontrado en produccion: fila en AUTHORIZED sin mpPreapprovalId, un solo
  // evento `created`, 13 dias sin tocarse. MP nunca autorizo nada. La regla
  // anterior le daba PRO gratis.
  it("AUTHORIZED sin periodo y SIN preapproval de MP: FREE", () => {
    expect(
      derivePlanFromSubscription(
        { status: "AUTHORIZED", currentPeriodEnd: null, mpPreapprovalId: null },
        NOW,
      ),
    ).toBe("FREE");
  });

  it("CANCELLED con periodo futuro: PRO hasta esa fecha (ya lo pago)", () => {
    expect(
      derivePlanFromSubscription(sub("CANCELLED", FUTURO), NOW),
    ).toBe("PRO");
  });

  // El bug encontrado en produccion: la regla anterior solo degradaba
  // comparando contra una fecha, asi que sin fecha concedia PRO para siempre.
  it("CANCELLED SIN periodo: FREE — no hay periodo pagado que honrar", () => {
    expect(
      derivePlanFromSubscription(sub("CANCELLED", null), NOW),
    ).toBe("FREE");
  });

  it("PAUSED se trata como CANCELLED: PRO solo si queda periodo", () => {
    expect(
      derivePlanFromSubscription(sub("PAUSED", FUTURO), NOW),
    ).toBe("PRO");
    expect(
      derivePlanFromSubscription(sub("PAUSED", null), NOW),
    ).toBe("FREE");
  });

  it.each(["PENDING", "EXPIRED", "FAILED"])("%s: FREE aunque tenga periodo futuro", (status) => {
    expect(derivePlanFromSubscription(sub(status, FUTURO), NOW)).toBe("FREE");
  });
});

describe("resolveEffectivePlan", () => {
  it("override PRO gana sobre una subscription que derivaria FREE", () => {
    expect(
      resolveEffectivePlan("PRO", sub("CANCELLED", PASADO), NOW),
    ).toBe("PRO");
  });

  it("override PRO sin ninguna subscription: PRO (concesion de admin pura)", () => {
    expect(resolveEffectivePlan("PRO", null, NOW)).toBe("PRO");
  });

  it("sin override: manda lo derivado", () => {
    expect(resolveEffectivePlan(null, sub("AUTHORIZED", FUTURO), NOW)).toBe("PRO");
    expect(resolveEffectivePlan(null, null, NOW)).toBe("FREE");
  });

  // El override solo guarda PRO por diseño. Si alguna vez llega un "FREE"
  // (dato viejo, escritura manual en la base), NO debe bloquear a un owner que
  // esta pagando: se ignora y manda lo derivado.
  it("override FREE se ignora: no le quita el plan a quien paga", () => {
    expect(
      resolveEffectivePlan("FREE", sub("AUTHORIZED", FUTURO), NOW),
    ).toBe("PRO");
  });
});
