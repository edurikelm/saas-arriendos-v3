import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type {
  DashboardPropertyBoard as BoardData,
  DashboardPropertyOccupant,
  DashboardPropertyStatus,
} from "@/lib/dashboard/summary";
import { DashboardPropertyBoard } from "../dashboard-property-board";

const TODAY = "2026-09-14";

function makeStatus(overrides: Partial<DashboardPropertyStatus> = {}): DashboardPropertyStatus {
  return {
    propertyId: "prop-1",
    propertyName: "Cabaña El Mirador",
    unitsAvailable: 1,
    unitsOccupied: 0,
    state: "FREE",
    nextRelease: null,
    nextArrival: null,
    ...overrides,
  };
}

function makeOccupant(overrides: Partial<DashboardPropertyOccupant> = {}): DashboardPropertyOccupant {
  return {
    source: "RESERVATION",
    reservationId: "res-1",
    billingType: "DAILY",
    channel: null,
    lastNightKey: "2026-09-17",
    releaseDateKey: "2026-09-18",
    ...overrides,
  };
}

function makeBoard(
  properties: DashboardPropertyStatus[],
  overrides: Partial<BoardData> = {},
): BoardData {
  return {
    properties,
    occupiedUnits: 0,
    totalUnits: properties.length,
    allSingleUnit: true,
    ...overrides,
  };
}

function rowText(name: string): string {
  return screen.getByRole("link", { name: new RegExp(name) }).textContent ?? "";
}

describe("DashboardPropertyBoard", () => {
  it("resume cuántas están ocupadas hoy", () => {
    render(
      <DashboardPropertyBoard
        board={makeBoard([makeStatus()], { occupiedUnits: 4, totalUnits: 7 })}
        todayKey={TODAY}
      />,
    );

    expect(screen.getByText(/de 7 ocupadas hoy/)).toBeTruthy();
  });

  it("con propiedades de varias unidades cuenta unidades, no propiedades", () => {
    render(
      <DashboardPropertyBoard
        board={makeBoard([makeStatus()], { occupiedUnits: 5, totalUnits: 9, allSingleUnit: false })}
        todayKey={TODAY}
      />,
    );

    expect(screen.getByText(/de 9 unidades ocupadas hoy/)).toBeTruthy();
  });

  it("describe cada ocupante con su propia frase", () => {
    const board = makeBoard([
      makeStatus({
        propertyId: "p-daily",
        propertyName: "Cabaña Los Robles",
        unitsOccupied: 1,
        state: "OCCUPIED",
        nextRelease: makeOccupant(),
      }),
      makeStatus({
        propertyId: "p-monthly",
        propertyName: "Cabaña 3",
        unitsOccupied: 1,
        state: "OCCUPIED",
        nextRelease: makeOccupant({
          reservationId: "res-2",
          billingType: "MONTHLY",
          lastNightKey: "2026-09-30",
          releaseDateKey: "2026-10-01",
        }),
      }),
      makeStatus({
        propertyId: "p-block",
        propertyName: "Casa Playa",
        unitsOccupied: 1,
        state: "OCCUPIED",
        nextRelease: makeOccupant({
          source: "EXTERNAL_BLOCK",
          reservationId: null,
          billingType: null,
          channel: "AIRBNB",
          lastNightKey: "2026-09-20",
          releaseDateKey: "2026-09-21",
        }),
      }),
    ]);

    render(<DashboardPropertyBoard board={board} todayKey={TODAY} />);

    expect(rowText("Cabaña Los Robles")).toContain("Ocupada · sale vie 18");
    expect(rowText("Cabaña 3")).toContain("Mensual · hasta 30 sept");
    expect(rowText("Casa Playa")).toContain("Airbnb · hasta 20 sept");
  });

  it("una propiedad libre dice cuándo llega el próximo huésped, si hay", () => {
    const board = makeBoard([
      makeStatus({
        propertyId: "p-1",
        propertyName: "Hostal Centro",
        nextArrival: { reservationId: "res-9", dateKey: "2026-09-26" },
      }),
      makeStatus({ propertyId: "p-2", propertyName: "Cabaña 4" }),
    ]);

    render(<DashboardPropertyBoard board={board} todayKey={TODAY} />);

    expect(rowText("Hostal Centro")).toContain("Libre · llega sáb 26");
    expect(rowText("Cabaña 4")).toBe("Cabaña 4Libre");
  });

  it("con varias unidades cuenta unidades en vez de nombrar al ocupante", () => {
    const release = makeOccupant({ lastNightKey: "2026-09-14", releaseDateKey: "2026-09-15" });
    const board = makeBoard(
      [
        makeStatus({
          propertyId: "p-partial",
          propertyName: "Depto Centro",
          unitsAvailable: 3,
          unitsOccupied: 2,
          state: "PARTIAL",
          nextRelease: release,
        }),
        makeStatus({
          propertyId: "p-full",
          propertyName: "Hostal Norte",
          unitsAvailable: 3,
          unitsOccupied: 3,
          state: "OCCUPIED",
          nextRelease: release,
        }),
      ],
      { allSingleUnit: false },
    );

    render(<DashboardPropertyBoard board={board} todayKey={TODAY} />);

    expect(rowText("Depto Centro")).toContain("2 de 3 ocupadas · próxima salida mañana");
    expect(rowText("Hostal Norte")).toContain("Completa · próxima salida mañana");
  });

  it("marca la sobreventa cuando se consumen más unidades de las que hay", () => {
    const board = makeBoard([
      makeStatus({
        unitsOccupied: 2,
        state: "OCCUPIED",
        nextRelease: makeOccupant({
          source: "EXTERNAL_BLOCK",
          reservationId: null,
          billingType: null,
          channel: "BOOKING_COM",
        }),
      }),
    ]);

    render(<DashboardPropertyBoard board={board} todayKey={TODAY} />);

    const row = screen.getByRole("link", { name: /Cabaña El Mirador/ });
    expect(within(row).getByText("Sobreventa")).toBeTruthy();
    expect(row.textContent).toContain("Sobreventa · 2 ocupaciones para 1 unidad");
  });

  it("cada fila enlaza al detalle de su propiedad", () => {
    render(<DashboardPropertyBoard board={makeBoard([makeStatus()])} todayKey={TODAY} />);

    const link = screen.getByRole("link", { name: /Cabaña El Mirador/ });
    expect(link.getAttribute("href")).toBe("/properties/prop-1");
  });
});
