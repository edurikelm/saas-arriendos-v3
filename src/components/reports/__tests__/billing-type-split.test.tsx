import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BillingTypeSplit } from "../billing-type-split";

describe("BillingTypeSplit", () => {
  it("shows an empty state when both are 0", () => {
    render(<BillingTypeSplit dailyCash={0} monthlyCash={0} />);
    expect(screen.getByText(/sin cobros registrados/i)).toBeTruthy();
  });

  it("computes percentages that add up to 100", () => {
    render(<BillingTypeSplit dailyCash={750_000} monthlyCash={250_000} />);
    expect(screen.getByText(/Diario · \$750\.000 \(75%\)/)).toBeTruthy();
    expect(screen.getByText(/Mensual · \$250\.000 \(25%\)/)).toBeTruthy();
  });

  it("handles all-daily split (100/0)", () => {
    render(<BillingTypeSplit dailyCash={500_000} monthlyCash={0} />);
    expect(screen.getByText(/Diario · \$500\.000 \(100%\)/)).toBeTruthy();
    expect(screen.getByText(/Mensual · \$0 \(0%\)/)).toBeTruthy();
  });
});
