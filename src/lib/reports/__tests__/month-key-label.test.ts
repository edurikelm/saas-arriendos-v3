import { describe, expect, it } from "vitest";

/**
 * monthKeyLabel mirrors the logic in reports-client.tsx.
 * Keep in sync: es-CL Intl.DateTimeFormat with UTC timezone.
 */
function monthKeyLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  return new Intl.DateTimeFormat("es-CL", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

describe("monthKeyLabel", () => {
  it("formats 2026-01 as a short month + year in Spanish", () => {
    const result = monthKeyLabel("2026-01");
    expect(result).toContain("2026");
    expect(result).toMatch(/ene/i);
  });

  it("formats 2026-07 correctly", () => {
    const result = monthKeyLabel("2026-07");
    expect(result).toContain("2026");
    expect(result).toMatch(/jul/i);
  });

  it("formats 2025-12 correctly", () => {
    const result = monthKeyLabel("2025-12");
    expect(result).toContain("2025");
    expect(result).toMatch(/dic/i);
  });

  it("formats 2026-12 (diciembre) como mes abreviado en español", () => {
    const result = monthKeyLabel("2026-12");
    expect(result).toContain("2026");
    expect(result).toMatch(/dic/i);
  });

  it("formats 2026-07 (julio) como mes abreviado en español", () => {
    const result = monthKeyLabel("2026-07");
    expect(result).toContain("2026");
    expect(result).toMatch(/jul/i);
  });

  it("formato coincide exactamente con Intl.DateTimeFormat es-CL UTC", () => {
    // monthKeyLabel usa Intl.DateTimeFormat("es-CL", { month: "short", year: "numeric", timeZone: "UTC" })
    const [year, month] = "2026-03".split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const expected = new Intl.DateTimeFormat("es-CL", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);

    const result = monthKeyLabel("2026-03");
    expect(result).toBe(expected);
  });

  it("formato coincide con Intl para 2026-12", () => {
    const [year, month] = "2026-12".split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const expected = new Intl.DateTimeFormat("es-CL", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);

    expect(monthKeyLabel("2026-12")).toBe(expected);
  });

  it("formato coincide con Intl para 2026-07", () => {
    const [year, month] = "2026-07".split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
    const expected = new Intl.DateTimeFormat("es-CL", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);

    expect(monthKeyLabel("2026-07")).toBe(expected);
  });
});
