import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonthlyCashChart } from "../monthly-cash-chart";
import type { MonthlyCollectedCash } from "@/lib/reports/revenue-series";

function makeMonth(overrides: Partial<MonthlyCollectedCash>): MonthlyCollectedCash {
  return {
    monthKey: "2026-01",
    collectedCash: 0,
    cancelledCash: 0,
    paymentCount: 0,
    ...overrides,
  };
}

describe("MonthlyCashChart", () => {
  it("shows an empty state when there are no months", () => {
    render(<MonthlyCashChart byMonth={[]} />);
    expect(screen.getByText(/sin cobros registrados/i)).toBeTruthy();
  });

  it("renders the max amount and its month", () => {
    render(
      <MonthlyCashChart
        byMonth={[
          makeMonth({ monthKey: "2026-01", collectedCash: 100_000, paymentCount: 2 }),
          makeMonth({ monthKey: "2026-02", collectedCash: 300_000, paymentCount: 5 }),
        ]}
      />
    );
    expect(screen.getAllByText(/\$300\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/feb/i).length).toBeGreaterThan(0);
  });

  it("provides a text alternative with all months for screen readers", () => {
    render(
      <MonthlyCashChart
        byMonth={[makeMonth({ monthKey: "2026-03", collectedCash: 50_000, paymentCount: 1 })]}
      />
    );
    expect(screen.getByText(/1 pago/i)).toBeTruthy();
  });
});
