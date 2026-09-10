import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarLegend } from "../calendar-legend";

describe("CalendarLegend", () => {
  describe("bar state entries (icon + semantic color, mirrors bar bg)", () => {
    it("renders 4 status state entries", () => {
      render(<CalendarLegend />);
      const states = ["Pendiente", "Confirmada", "Cancelada", "Completada"];
      states.forEach((state) => {
        expect(screen.getByText(state)).toBeDefined();
      });
    });

    it("each status entry has an icon (svg) child", () => {
      const { container } = render(<CalendarLegend />);
      const statusContainer = screen.getByText("Estado").parentElement!;
      const entries = Array.from(statusContainer.querySelectorAll("div")).filter((d) =>
        ["Pendiente", "Confirmada", "Cancelada", "Completada"].some((s) =>
          d.textContent?.includes(s),
        ),
      );
      entries.forEach((entry) => {
        const svg = entry.querySelector("svg");
        expect(svg).not.toBeNull();
      });
    });

    it("los íconos usan el compañero -text de cada tono, no el token de relleno", () => {
      const { container } = render(<CalendarLegend />);
      // Fill-vs-Text Rule (DESIGN.md): sobre `--card` va `--{tono}-text`, nunca
      // `--{tono}` a secas. Los de relleno miden 2.05:1 (warning) y 3.03:1
      // (success) sobre card en claro, bajo el mínimo AA de 4.5:1.
      expect(container.querySelectorAll(".text-warning-text").length).toBeGreaterThan(0);
      expect(container.querySelectorAll(".text-success-text").length).toBeGreaterThan(0);
      expect(container.querySelectorAll(".text-destructive-text").length).toBeGreaterThan(0);
      expect(container.querySelectorAll(".text-muted-foreground").length).toBeGreaterThan(0);
    });

    it("ningún ícono usa un token de RELLENO como color de texto", () => {
      const { container } = render(<CalendarLegend showChannels />);
      // Guarda directa contra la regresión: `text-warning` / `text-success` /
      // `text-info` como color de texto. Los dots de canal SÍ pueden usar el
      // relleno (`bg-{tono}`) porque son superficie, no texto.
      for (const prohibido of ["text-warning", "text-success", "text-info"]) {
        const usados = [...container.querySelectorAll<HTMLElement>("*")].filter((el) =>
          el.classList.contains(prohibido),
        );
        expect(usados, `${prohibido} es token de relleno, no de texto`).toHaveLength(0);
      }
    });

    it("CANCELLED and COMPLETADA labels do NOT carry line-through (only the bar pills do)", () => {
      // Polish fix: un label tachado sugiere "filtro deshabilitado" — anti-patrón UX.
      // El strikethrough vive SOLO dentro de las reservation pills (calendar-timeline.tsx),
      // nunca en los labels de la leyenda. La diferenciación terminal se hace vía opacity-75.
      const { container } = render(<CalendarLegend />);
      const allSpans = Array.from(container.querySelectorAll("span"));
      const labels = allSpans.filter(
        (s) => ["Cancelada", "Completada"].includes(s.textContent?.trim() ?? ""),
      );
      expect(labels.length).toBeGreaterThan(0);
      labels.forEach((label) => {
        expect(label.className).not.toMatch(/line-through/);
      });
    });

    it("COMPLETADA entry has opacity-75 wrapper (mirrors bar opacity treatment)", () => {
      const { container } = render(<CalendarLegend />);
      const opacity75 = container.querySelectorAll(".opacity-75");
      expect(opacity75.length).toBeGreaterThanOrEqual(1);
    });

    it("does not use rounded-full on any legend element (Calm Water Rule)", () => {
      const { container } = render(<CalendarLegend />);
      const dots = container.querySelectorAll("span");
      dots.forEach((dot) => {
        expect(dot.className).not.toMatch(/rounded-full/);
      });
    });
  });

  describe("channel entries", () => {
    it("does not render channel entries when showChannels is false", () => {
      render(<CalendarLegend showChannels={false} />);
      expect(screen.queryByText("Airbnb")).toBeNull();
      expect(screen.queryByText("Booking")).toBeNull();
      expect(screen.queryByText("VRBO")).toBeNull();
      expect(screen.queryByText("Otro")).toBeNull();
    });

    it("renders 4 channel entries when showChannels is true", () => {
      render(<CalendarLegend showChannels={true} />);
      const channels = ["Airbnb", "Booking", "VRBO", "Otro"];
      channels.forEach((channel) => {
        expect(screen.getByText(channel)).toBeDefined();
      });
    });

    it("does NOT render channel letters (A/B/V/?) — only dot + label", () => {
      // Polish fix: el prefijo "A Airbnb" / "B Booking" parecía un índice de DB
      // escapado a UI. Ahora cada canal es solo dot semántico + label uppercase.
      render(<CalendarLegend showChannels={true} />);
      expect(screen.queryByText(/^A$/)).toBeNull();
      expect(screen.queryByText(/^B$/)).toBeNull();
      expect(screen.queryByText(/^V$/)).toBeNull();
      expect(screen.queryByText(/^\?$/)).toBeNull();
    });

    it("channel dots have correct semantic dotClass from channel-colors", () => {
      render(<CalendarLegend showChannels={true} />);
      const container = document.querySelector("[aria-label='Leyenda del calendario']");
      expect(container).toBeDefined();
      // AIRBNB → bg-info, BOOKING_COM → bg-primary, VRBO → bg-accent, OTHER → bg-muted-foreground
      const infoDots = container?.querySelectorAll(".bg-info");
      const primaryDots = container?.querySelectorAll(".bg-primary");
      const accentDots = container?.querySelectorAll(".bg-accent");
      const mutedDots = container?.querySelectorAll(".bg-muted-foreground");
      expect(infoDots?.length).toBeGreaterThan(0); // Airbnb
      expect(primaryDots?.length).toBeGreaterThan(0); // Booking
      expect(accentDots?.length).toBeGreaterThan(0); // VRBO
      expect(mutedDots?.length).toBeGreaterThan(0); // Otro
    });
  });

  it("legend has accessible name 'Leyenda del calendario'", () => {
    render(<CalendarLegend />);
    expect(screen.getByLabelText("Leyenda del calendario")).toBeDefined();
  });
});