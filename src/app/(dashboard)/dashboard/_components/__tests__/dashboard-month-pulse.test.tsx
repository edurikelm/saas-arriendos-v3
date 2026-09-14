import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { DashboardMonthPulse as MonthData } from "@/lib/dashboard/summary";
import { DashboardMonthPulse } from "../dashboard-month-pulse";

const MONTH: MonthData = {
  monthKey: "2026-09",
  dayOfMonth: 14,
  collected: 2_200_000,
  previousMonthKey: "2026-08",
  previousCutoffDay: 14,
  collectedPreviousSamePeriod: 0,
  occupancyRate: 41,
  occupiedNightUnits: 86,
  capacityNightUnits: 210,
};

describe("DashboardMonthPulse", () => {
  it("titula la sección con el mes en curso", () => {
    render(<DashboardMonthPulse month={MONTH} />);

    expect(screen.getByRole("heading", { name: "Septiembre" })).toBeTruthy();
  });

  // Contra el mismo tramo del mes anterior y en monto: un porcentaje contra el
  // mes completo marcaba caída cada comienzo de mes.
  it("compara lo cobrado con el mismo tramo del mes anterior", () => {
    render(<DashboardMonthPulse month={{ ...MONTH, collectedPreviousSamePeriod: 500_000 }} />);

    const cobrado = screen.getByRole("group", { name: "Cobrado" });
    expect(within(cobrado).getByText("$2.200.000")).toBeTruthy();
    expect(within(cobrado).getByText("Al 14 de agosto: $500.000")).toBeTruthy();
  });

  it("muestra la ocupación del mes con las noches detrás del porcentaje", () => {
    render(<DashboardMonthPulse month={MONTH} />);

    const ocupacion = screen.getByRole("group", { name: "Ocupación del mes" });
    expect(within(ocupacion).getByText("41%")).toBeTruthy();
    expect(within(ocupacion).getByText("86 de 210 noches")).toBeTruthy();
  });
});
