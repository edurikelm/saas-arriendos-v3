import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "../kpi-card";

/**
 * indicatorClasses() contract (see kpi-card.tsx). JSDOM does not resolve CSS
 * custom properties or paint pixels, so these tests cannot measure contrast —
 * they can only assert which Tailwind class each variant renders. The ratios
 * noted below are pre-computed against the tokens in `src/app/globals.css`
 * (light / dark) and are the reason each class is correct; this file does not
 * verify them.
 */
describe("KpiCard indicator (P0 contrast fix)", () => {
  it("renders text-warning-foreground for the warning variant, not text-destructive-foreground", () => {
    // text-warning-foreground on --card: 13.93:1 light / 10.43:1 dark — passes AA.
    // text-destructive-foreground on --card: 1.00:1 light — white text on white card,
    // effectively invisible. That token is the white-on-fill color for destructive
    // buttons, not a readable foreground-on-card color.
    render(
      <KpiCard
        label="Pagos Pendientes"
        value={4}
        indicator={{ text: "2 vencidos", variant: "warning" }}
      />
    );

    const indicatorEl = screen.getByText("2 vencidos").parentElement;
    expect(indicatorEl).not.toBeNull();
    const tokens = indicatorEl!.className.split(/\s+/);

    expect(tokens).toContain("text-warning-foreground");
    expect(tokens).not.toContain("text-destructive-foreground");
  });

  it("renders text-success-foreground for the positive variant", () => {
    // text-success-foreground on --card passes WCAG AA in both themes (dark green
    // on light, light green on dark) — unaffected by this fix, covered here so the
    // test documents the full contract of indicatorClasses().
    render(
      <KpiCard
        label="Ingresos Mensuales"
        value="$100.000"
        indicator={{ text: "+12% vs período anterior", variant: "positive" }}
      />
    );

    const indicatorEl = screen.getByText("+12% vs período anterior").parentElement;
    expect(indicatorEl).not.toBeNull();
    const tokens = indicatorEl!.className.split(/\s+/);

    expect(tokens).toContain("text-success-foreground");
  });

  it("renders text-muted-foreground for the neutral variant", () => {
    render(
      <KpiCard
        label="Próximas Reservas"
        value={0}
        indicator={{ text: "Sin check-ins próximos", variant: "neutral" }}
      />
    );

    const indicatorEl = screen.getByText("Sin check-ins próximos").parentElement;
    expect(indicatorEl).not.toBeNull();
    const tokens = indicatorEl!.className.split(/\s+/);

    expect(tokens).toContain("text-muted-foreground");
  });
});
