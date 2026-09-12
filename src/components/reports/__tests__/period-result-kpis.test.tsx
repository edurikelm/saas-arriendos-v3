import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PeriodResultKpis } from "../period-result-kpis";

describe("PeriodResultKpis", () => {
  it("shows '—' for the collection rate when accruedRevenue is 0", () => {
    render(<PeriodResultKpis collectedCash={100_000} accruedRevenue={0} revenueTrend={null} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders the real rate even above 100% (prepayment case) without clamping", () => {
    render(<PeriodResultKpis collectedCash={900_000} accruedRevenue={500_000} revenueTrend={null} />);
    expect(screen.getByText("180%")).toBeTruthy();
  });

  it("renders the honesty note about the two accounting bases", () => {
    render(<PeriodResultKpis collectedCash={100_000} accruedRevenue={100_000} revenueTrend={null} />);
    expect(screen.getByText(/caja recibida en el rango/i)).toBeTruthy();
  });

  it("formats collected cash and accrued revenue as CLP", () => {
    render(<PeriodResultKpis collectedCash={1_500_000} accruedRevenue={2_000_000} revenueTrend={null} />);
    expect(screen.getByText("$1.500.000")).toBeTruthy();
    expect(screen.getByText("$2.000.000")).toBeTruthy();
  });

  it("shows the trend indicator when revenueTrend has a direction", () => {
    render(
      <PeriodResultKpis
        collectedCash={100_000}
        accruedRevenue={100_000}
        revenueTrend={{ direction: "up", pct: 20, label: "vs período anterior" }}
      />
    );
    expect(screen.getByText(/\+20% vs período anterior/)).toBeTruthy();
  });
});
