import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PropertySummaryTable } from "../property-summary-table";
import type { DecisionByPropertyEntry } from "@/lib/reports/decision-summary";

function makeRow(overrides: Partial<DecisionByPropertyEntry>): DecisionByPropertyEntry {
  return {
    propertyId: "p1",
    propertyName: "Depto Centro",
    activity: "DAILY",
    collectedCash: 0,
    collectedCashFromCancelledReservations: 0,
    outstandingBalance: 0,
    accruedRevenue: 0,
    occupiedNightUnits: 0,
    capacityNightUnits: 0,
    occupancyRate: 0,
    reservationCount: 0,
    ...overrides,
  };
}

describe("PropertySummaryTable", () => {
  it("shows the empty state when there are no rows and no totals row", () => {
    render(<PropertySummaryTable rows={[]} />);
    expect(screen.getByText(/sin propiedades en el rango/i)).toBeTruthy();
    expect(screen.queryByText("Total")).toBeNull();
  });

  it("does not render a 'Modalidad' or 'Unidades-noche' column", () => {
    render(<PropertySummaryTable rows={[makeRow({})]} />);
    expect(screen.queryByText("Modalidad")).toBeNull();
    expect(screen.queryByText("Unidades-noche")).toBeNull();
  });

  it("renders a totals row summing across properties", () => {
    const rows = [
      makeRow({
        propertyId: "p1",
        propertyName: "Depto Centro",
        collectedCash: 100_000,
        outstandingBalance: 15_000,
        occupiedNightUnits: 10,
        capacityNightUnits: 20,
        reservationCount: 2,
      }),
      makeRow({
        propertyId: "p2",
        propertyName: "Casa Sur",
        collectedCash: 50_000,
        outstandingBalance: 5_000,
        occupiedNightUnits: 5,
        capacityNightUnits: 20,
        reservationCount: 1,
      }),
    ];
    render(<PropertySummaryTable rows={rows} />);
    expect(screen.getByText("Total")).toBeTruthy();
    // Totals: collected 150.000, outstanding 20.000, occupancy 15/40 = 38%, reservations 3
    expect(screen.getByText("$150.000")).toBeTruthy();
    expect(screen.getByText("$20.000")).toBeTruthy();
    expect(screen.getByText("38%")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("shows an em dash for outstanding balance when there is none", () => {
    render(<PropertySummaryTable rows={[makeRow({ outstandingBalance: 0 })]} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
