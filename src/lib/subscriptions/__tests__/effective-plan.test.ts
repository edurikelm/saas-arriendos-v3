import { describe, it, expect } from "vitest";
import { computeEffectivePlan } from "../effective-plan";

const NOW = new Date("2026-08-24T12:00:00Z");
const PAST = new Date("2026-08-01T00:00:00Z");
const FUTURE = new Date("2026-09-01T00:00:00Z");

describe("computeEffectivePlan", () => {
  it("retorna FREE si UserProfile.plan es FREE, sin importar la subscription", () => {
    expect(
      computeEffectivePlan("FREE", { status: "AUTHORIZED", currentPeriodEnd: FUTURE }, NOW),
    ).toBe("FREE");
  });

  it("retorna FREE si UserProfile.plan es null", () => {
    expect(computeEffectivePlan(null, null, NOW)).toBe("FREE");
  });

  it("retorna PRO si el plan es PRO y no hay subscription asociada", () => {
    expect(computeEffectivePlan("PRO", null, NOW)).toBe("PRO");
  });

  it("retorna PRO si el plan es PRO y el período vigente aún no vence", () => {
    expect(
      computeEffectivePlan("PRO", { status: "AUTHORIZED", currentPeriodEnd: FUTURE }, NOW),
    ).toBe("PRO");
  });

  it("retorna PRO si currentPeriodEnd es null (sin fecha de vencimiento registrada)", () => {
    expect(
      computeEffectivePlan("PRO", { status: "AUTHORIZED", currentPeriodEnd: null }, NOW),
    ).toBe("PRO");
  });

  it("regresión: retorna FREE si plan=PRO cacheado pero la subscription AUTHORIZED ya venció (ventana del cron diario)", () => {
    expect(
      computeEffectivePlan("PRO", { status: "AUTHORIZED", currentPeriodEnd: PAST }, NOW),
    ).toBe("FREE");
  });

  it("regresión: retorna FREE si plan=PRO cacheado pero la subscription CANCELLED ya venció", () => {
    expect(
      computeEffectivePlan("PRO", { status: "CANCELLED", currentPeriodEnd: PAST }, NOW),
    ).toBe("FREE");
  });

  it("retorna PRO si la subscription venció pero su status no es AUTHORIZED/CANCELLED (ej. PAUSED)", () => {
    expect(
      computeEffectivePlan("PRO", { status: "PAUSED", currentPeriodEnd: PAST }, NOW),
    ).toBe("PRO");
  });
});
