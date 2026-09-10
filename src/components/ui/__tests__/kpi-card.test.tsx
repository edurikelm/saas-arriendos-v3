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
  it("renders text-warning-text for the warning variant, not text-destructive-foreground", () => {
    // text-warning-text on --card: 5.40:1 light / 9.62:1 dark — passes AA and
    // still reads amber. text-warning-foreground is the wrong level here: it's
    // meant to sit ON TOP OF bg-warning opaque (badge fill text), not on --card.
    // text-destructive-foreground on --card: 1.00:1 light — white text on white
    // card, effectively invisible. That token is the white-on-fill color for
    // destructive buttons, not a readable foreground-on-card color.
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

    expect(tokens).toContain("text-warning-text");
    expect(tokens).not.toContain("text-destructive-foreground");
  });

  it("renders text-success-text for the positive variant", () => {
    // text-success-text on --card passes WCAG AA in both themes and keeps
    // reading green — unaffected by this fix, covered here so the test
    // documents the full contract of indicatorClasses().
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

    expect(tokens).toContain("text-success-text");
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

/**
 * valueToneClass (see kpi-card.tsx). Mismo caveat que arriba: JSDOM no mide
 * contraste, solo verificamos la clase Tailwind. Las ratios estan documentadas
 * en el comentario de valueToneClass y en DESIGN.md (The Fill-vs-Text Rule).
 */
describe("KpiCard value tone (Fill-vs-Text contrast fix)", () => {
  it("renders text-success-text for tone success, not text-success", () => {
    // text-success sobre --card mide 3.03:1 en claro (relleno, no texto).
    // text-success-text es el companero legible: 5.34:1 en claro, 8.19:1 en
    // oscuro, y a diferencia de -foreground (L=0.30, se lee negro) sigue
    // leyendose verde, que es el unico trabajo de un valor coloreado.
    render(<KpiCard label="Ingresos" value="$18.600.000" tone="success" />);

    const valueEl = screen.getByText("$18.600.000");
    const tokens = valueEl.className.split(/\s+/);

    expect(tokens).toContain("text-success-text");
    expect(tokens).not.toContain("text-success");
    expect(tokens).not.toContain("text-success-foreground");
  });

  it("renders text-warning-text for tone warning, not text-warning", () => {
    // text-warning sobre --card mide 2.05:1 en claro (relleno, no texto).
    // text-warning-text: 5.40:1 claro / 9.62:1 oscuro, y se sigue leyendo ambar.
    render(<KpiCard label="Pendiente" value="$1.200.000" tone="warning" />);

    const valueEl = screen.getByText("$1.200.000");
    const tokens = valueEl.className.split(/\s+/);

    expect(tokens).toContain("text-warning-text");
    expect(tokens).not.toContain("text-warning");
    expect(tokens).not.toContain("text-warning-foreground");
  });

  it("renders text-destructive-text for tone destructive (unchanged)", () => {
    render(<KpiCard label="Vencido" value="$300.000" tone="destructive" />);

    const valueEl = screen.getByText("$300.000");
    const tokens = valueEl.className.split(/\s+/);

    expect(tokens).toContain("text-destructive-text");
  });

  it("renders text-foreground for tone default and tone info (neutral, sin enfasis)", () => {
    render(
      <>
        <KpiCard label="Reservas" value={12} tone="default" />
        <KpiCard label="Ocupacion" value="80%" tone="info" />
      </>
    );

    expect(screen.getByText("12").className.split(/\s+/)).toContain("text-foreground");
    expect(screen.getByText("80%").className.split(/\s+/)).toContain("text-foreground");
  });
});
