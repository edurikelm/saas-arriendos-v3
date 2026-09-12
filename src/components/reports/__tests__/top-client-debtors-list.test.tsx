import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopClientDebtorsList } from "../top-client-debtors-list";
import type { ClientDebtor } from "@/lib/reports/trend";

describe("TopClientDebtorsList", () => {
  it("shows an empty state when there are no debtors", () => {
    render(<TopClientDebtorsList debtors={[]} />);
    expect(screen.getByText(/sin deudores activos/i)).toBeTruthy();
  });

  it("renders client, property, billing type, days overdue and amount", () => {
    const debtors: ClientDebtor[] = [
      {
        clientId: "c1",
        clientName: "Juan Pérez",
        propertyName: "Depto Centro",
        billingType: "MONTHLY",
        amount: 250_000,
        daysOverdue: 15,
      },
    ];
    render(<TopClientDebtorsList debtors={debtors} />);
    expect(screen.getByText("Juan Pérez")).toBeTruthy();
    expect(screen.getByText(/Depto Centro · Mensual · 15 días de atraso/)).toBeTruthy();
    expect(screen.getByText("$250.000")).toBeTruthy();
  });

  it("omits the days-overdue segment when daysOverdue is 0", () => {
    const debtors: ClientDebtor[] = [
      {
        clientId: "c2",
        clientName: "María López",
        propertyName: "Casa Sur",
        billingType: "DAILY",
        amount: 80_000,
        daysOverdue: 0,
      },
    ];
    render(<TopClientDebtorsList debtors={debtors} />);
    expect(screen.getByText("Casa Sur · Diario")).toBeTruthy();
  });
});
