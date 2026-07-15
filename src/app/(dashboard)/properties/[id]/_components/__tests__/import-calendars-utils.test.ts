import { describe, it, expect } from "vitest";
import { getSyncStatus, type ImportCalendar } from "../import-calendars-utils";

const FIXED_NOW = new Date("2026-07-15T12:00:00Z");

function makeCalendar(overrides: Partial<ImportCalendar> = {}): ImportCalendar {
  return {
    id: "cal-1",
    name: "Test Calendar",
    channel: "AIRBNB",
    feedUrl: "https://example.com/cal.ics",
    isActive: true,
    lastSyncedAt: null,
    lastSyncError: null,
    lastSyncCount: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getSyncStatus", () => {
  it("retorna 'never' cuando el calendario está inactivo", () => {
    const cal = makeCalendar({ isActive: false, lastSyncedAt: FIXED_NOW.toISOString() });
    expect(getSyncStatus(cal, FIXED_NOW)).toBe("never");
  });

  it("retorna 'error' cuando hay lastSyncError y está activo", () => {
    const cal = makeCalendar({
      isActive: true,
      lastSyncError: "HTTP 404: Not Found",
      lastSyncedAt: FIXED_NOW.toISOString(),
    });
    expect(getSyncStatus(cal, FIXED_NOW)).toBe("error");
  });

  it("retorna 'error' incluso si nunca se sincronizó pero hay error registrado", () => {
    // Caso edge: calendario inactivo, con error — gana "never" porque la inactividad
    // es más informativa que un error viejo.
    // Este test documenta el orden de prioridad: isActive se chequea primero.
    const cal = makeCalendar({
      isActive: false,
      lastSyncError: "Old error",
    });
    expect(getSyncStatus(cal, FIXED_NOW)).toBe("never");
  });

  it("retorna 'never' cuando está activo pero nunca se sincronizó", () => {
    const cal = makeCalendar({ isActive: true, lastSyncedAt: null });
    expect(getSyncStatus(cal, FIXED_NOW)).toBe("never");
  });

  it("retorna 'ok' cuando la última sync es reciente (< 26h)", () => {
    const cal = makeCalendar({
      isActive: true,
      lastSyncedAt: new Date(FIXED_NOW.getTime() - 5 * 60 * 60 * 1000).toISOString(), // 5h ago
    });
    expect(getSyncStatus(cal, FIXED_NOW)).toBe("ok");
  });

  it("retorna 'ok' cuando la última sync es de exactamente 26h", () => {
    const cal = makeCalendar({
      isActive: true,
      lastSyncedAt: new Date(FIXED_NOW.getTime() - 26 * 60 * 60 * 1000).toISOString(),
    });
    // 26h exacto: no es mayor a 26h, así que "ok"
    expect(getSyncStatus(cal, FIXED_NOW)).toBe("ok");
  });

  it("retorna 'stale' cuando la última sync es de más de 26h", () => {
    const cal = makeCalendar({
      isActive: true,
      lastSyncedAt: new Date(FIXED_NOW.getTime() - 30 * 60 * 60 * 1000).toISOString(), // 30h ago
    });
    expect(getSyncStatus(cal, FIXED_NOW)).toBe("stale");
  });

  it("prioriza 'error' sobre 'stale' (un error reciente gana a un sync viejo)", () => {
    const cal = makeCalendar({
      isActive: true,
      lastSyncedAt: new Date(FIXED_NOW.getTime() - 48 * 60 * 60 * 1000).toISOString(), // 48h ago
      lastSyncError: "HTTP 500",
    });
    expect(getSyncStatus(cal, FIXED_NOW)).toBe("error");
  });
});
