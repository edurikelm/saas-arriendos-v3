import { describe, it, expect } from "vitest";
import { canTransition } from "../state-machine";
import type { SubscriptionStatus } from "@prisma/client";

const STATUSES: SubscriptionStatus[] = [
  "PENDING",
  "AUTHORIZED",
  "PAUSED",
  "CANCELLED",
  "EXPIRED",
  "FAILED",
];

// ────────────────────────────────────────────────────────────────────────────
// Tests de la tabla 6x6 — transiciones válidas (✓)
// ────────────────────────────────────────────────────────────────────────────

describe("canTransition — transiciones válidas (✓)", () => {
  it("(none) → PENDING", () => {
    expect(canTransition(null, "PENDING")).toBe(true);
  });

  it("PENDING → AUTHORIZED", () => {
    expect(canTransition("PENDING", "AUTHORIZED")).toBe(true);
  });

  it("PENDING → PAUSED", () => {
    expect(canTransition("PENDING", "PAUSED")).toBe(true);
  });

  it("PENDING → CANCELLED", () => {
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
  });

  it("PENDING → EXPIRED", () => {
    expect(canTransition("PENDING", "EXPIRED")).toBe(true);
  });

  it("AUTHORIZED → PAUSED", () => {
    expect(canTransition("AUTHORIZED", "PAUSED")).toBe(true);
  });

  it("AUTHORIZED → CANCELLED", () => {
    expect(canTransition("AUTHORIZED", "CANCELLED")).toBe(true);
  });

  it("AUTHORIZED → EXPIRED", () => {
    expect(canTransition("AUTHORIZED", "EXPIRED")).toBe(true);
  });

  it("AUTHORIZED → FAILED", () => {
    expect(canTransition("AUTHORIZED", "FAILED")).toBe(true);
  });

  it("PAUSED → AUTHORIZED", () => {
    expect(canTransition("PAUSED", "AUTHORIZED")).toBe(true);
  });

  it("PAUSED → CANCELLED", () => {
    expect(canTransition("PAUSED", "CANCELLED")).toBe(true);
  });

  it("PAUSED → EXPIRED", () => {
    expect(canTransition("PAUSED", "EXPIRED")).toBe(true);
  });

  it("CANCELLED → EXPIRED", () => {
    expect(canTransition("CANCELLED", "EXPIRED")).toBe(true);
  });

  it("CANCELLED → AUTHORIZED (reactivación manual antes de expirar)", () => {
    expect(canTransition("CANCELLED", "AUTHORIZED")).toBe(true);
  });

  it("EXPIRED → AUTHORIZED", () => {
    expect(canTransition("EXPIRED", "AUTHORIZED")).toBe(true);
  });

  it("FAILED → AUTHORIZED", () => {
    expect(canTransition("FAILED", "AUTHORIZED")).toBe(true);
  });

  it("FAILED → PAUSED", () => {
    expect(canTransition("FAILED", "PAUSED")).toBe(true);
  });

  it("FAILED → CANCELLED", () => {
    expect(canTransition("FAILED", "CANCELLED")).toBe(true);
  });

  it("FAILED → EXPIRED", () => {
    expect(canTransition("FAILED", "EXPIRED")).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Tests de la tabla 6x6 — transiciones inválidas (✗)
// ────────────────────────────────────────────────────────────────────────────

describe("canTransition — transiciones inválidas", () => {
  it("(none) → cualquier estado que no sea PENDING es inválido", () => {
    for (const status of STATUSES) {
      if (status !== "PENDING") {
        expect(canTransition(null, status)).toBe(false);
      }
    }
  });

  it("PENDING → FAILED", () => {
    expect(canTransition("PENDING", "FAILED")).toBe(false);
  });

  it("AUTHORIZED → PENDING", () => {
    expect(canTransition("AUTHORIZED", "PENDING")).toBe(false);
  });

  it("PAUSED → PENDING", () => {
    expect(canTransition("PAUSED", "PENDING")).toBe(false);
  });

  it("PAUSED → FAILED", () => {
    expect(canTransition("PAUSED", "FAILED")).toBe(false);
  });

  it("CANCELLED → cualquier estado excepto AUTHORIZED y EXPIRED", () => {
    expect(canTransition("CANCELLED", "PENDING")).toBe(false);
    expect(canTransition("CANCELLED", "PAUSED")).toBe(false);
    expect(canTransition("CANCELLED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "FAILED")).toBe(false);
  });

  it("EXPIRED → cualquier estado excepto AUTHORIZED", () => {
    expect(canTransition("EXPIRED", "PENDING")).toBe(false);
    expect(canTransition("EXPIRED", "PAUSED")).toBe(false);
    expect(canTransition("EXPIRED", "CANCELLED")).toBe(false);
    expect(canTransition("EXPIRED", "EXPIRED")).toBe(false);
    expect(canTransition("EXPIRED", "FAILED")).toBe(false);
  });

  it("FAILED → PENDING", () => {
    expect(canTransition("FAILED", "PENDING")).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Cobertura exhaustiva — matriz completa 6x6
// ────────────────────────────────────────────────────────────────────────────

describe("cobertura exhaustiva — matriz 6x6 completa", () => {
  // Tabla codificada: [from, to, expectedResult]
  const MATRIX: [SubscriptionStatus | null, SubscriptionStatus, boolean][] = [
    // from=null
    [null, "PENDING", true],
    [null, "AUTHORIZED", false],
    [null, "PAUSED", false],
    [null, "CANCELLED", false],
    [null, "EXPIRED", false],
    [null, "FAILED", false],
    // from=PENDING
    ["PENDING", "PENDING", false],
    ["PENDING", "AUTHORIZED", true],
    ["PENDING", "PAUSED", true],
    ["PENDING", "CANCELLED", true],
    ["PENDING", "EXPIRED", true],
    ["PENDING", "FAILED", false],
    // from=AUTHORIZED
    ["AUTHORIZED", "PENDING", false],
    ["AUTHORIZED", "AUTHORIZED", false],
    ["AUTHORIZED", "PAUSED", true],
    ["AUTHORIZED", "CANCELLED", true],
    ["AUTHORIZED", "EXPIRED", true],
    ["AUTHORIZED", "FAILED", true],
    // from=PAUSED
    ["PAUSED", "PENDING", false],
    ["PAUSED", "AUTHORIZED", true],
    ["PAUSED", "PAUSED", false],
    ["PAUSED", "CANCELLED", true],
    ["PAUSED", "EXPIRED", true],
    ["PAUSED", "FAILED", false],
    // from=CANCELLED
    ["CANCELLED", "PENDING", false],
    ["CANCELLED", "AUTHORIZED", true],
    ["CANCELLED", "PAUSED", false],
    ["CANCELLED", "CANCELLED", false],
    ["CANCELLED", "EXPIRED", true],
    ["CANCELLED", "FAILED", false],
    // from=EXPIRED
    ["EXPIRED", "PENDING", false],
    ["EXPIRED", "AUTHORIZED", true],
    ["EXPIRED", "PAUSED", false],
    ["EXPIRED", "CANCELLED", false],
    ["EXPIRED", "EXPIRED", false],
    ["EXPIRED", "FAILED", false],
    // from=FAILED
    ["FAILED", "PENDING", false],
    ["FAILED", "AUTHORIZED", true],
    ["FAILED", "PAUSED", true],
    ["FAILED", "CANCELLED", true],
    ["FAILED", "EXPIRED", true],
    ["FAILED", "FAILED", false],
  ];

  it.each(MATRIX)(
    "canTransition(%s, %s) = %s",
    (from, to, expected) => {
      expect(canTransition(from, to)).toBe(expected);
    },
  );
});
