/**
 * `canStartUpgrade` es el reflejo de UI de la regla que aplica `startProUpgrade`
 * para decidir si reemplaza una fila EXPIRED/FAILED/CANCELLED-vencida en vez de
 * bloquear. Ver el comentario del módulo para el porqué de cada caso.
 */

import { describe, it, expect } from "vitest";
import { canStartUpgrade } from "@/lib/subscriptions/upgrade-eligibility";

const NOW = new Date("2026-09-03T12:00:00.000Z");
const FUTURO = new Date("2026-10-01T00:00:00.000Z");
const PASADO = new Date("2026-08-01T00:00:00.000Z");

describe("canStartUpgrade", () => {
  it("sin subscription: elegible", () => {
    expect(canStartUpgrade(null, NOW)).toBe(true);
  });

  it("EXPIRED: elegible", () => {
    expect(
      canStartUpgrade({ status: "EXPIRED", currentPeriodEnd: null }, NOW),
    ).toBe(true);
  });

  it("FAILED: elegible", () => {
    expect(
      canStartUpgrade({ status: "FAILED", currentPeriodEnd: FUTURO }, NOW),
    ).toBe(true);
  });

  it("AUTHORIZED: no elegible (ya tiene PRO activo)", () => {
    expect(
      canStartUpgrade({ status: "AUTHORIZED", currentPeriodEnd: FUTURO }, NOW),
    ).toBe(false);
  });

  it("PAUSED: no elegible", () => {
    expect(
      canStartUpgrade({ status: "PAUSED", currentPeriodEnd: FUTURO }, NOW),
    ).toBe(false);
  });

  it("PENDING: no elegible (hay un pago pendiente de autorizar)", () => {
    expect(
      canStartUpgrade({ status: "PENDING", currentPeriodEnd: null }, NOW),
    ).toBe(false);
  });

  it("CANCELLED con currentPeriodEnd futuro: no elegible (sigue PRO)", () => {
    expect(
      canStartUpgrade({ status: "CANCELLED", currentPeriodEnd: FUTURO }, NOW),
    ).toBe(false);
  });

  it("CANCELLED con currentPeriodEnd pasado: elegible", () => {
    expect(
      canStartUpgrade({ status: "CANCELLED", currentPeriodEnd: PASADO }, NOW),
    ).toBe(true);
  });

  it("CANCELLED con currentPeriodEnd igual a now: elegible (borde inclusivo)", () => {
    expect(
      canStartUpgrade({ status: "CANCELLED", currentPeriodEnd: NOW }, NOW),
    ).toBe(true);
  });

  it("CANCELLED con currentPeriodEnd null: no elegible (tratado como vigente)", () => {
    expect(
      canStartUpgrade({ status: "CANCELLED", currentPeriodEnd: null }, NOW),
    ).toBe(false);
  });
});
