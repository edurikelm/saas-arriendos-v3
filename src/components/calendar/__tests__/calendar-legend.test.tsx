import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarLegend } from "../calendar-legend";

describe("CalendarLegend", () => {
  describe("bar state entries", () => {
    it("renders 4 bar state entries", () => {
      render(<CalendarLegend />);
      const states = ["Activa", "Próxima", "Cancelada", "Finalizada"];
      states.forEach((state) => {
        expect(screen.getByText(state)).toBeDefined();
      });
    });

    it("each bar state entry has a visible dot", () => {
      render(<CalendarLegend />);
      const dots = document.querySelectorAll(".bg-success, .bg-info, .bg-destructive, .bg-muted-foreground");
      // 4 bar state dots when channels not shown
      expect(dots.length).toBeGreaterThanOrEqual(4);
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

    it("renders channel letter A for Airbnb", () => {
      render(<CalendarLegend showChannels={true} />);
      expect(screen.getByText(/^A$/)).toBeDefined();
      expect(screen.getByText("Airbnb")).toBeDefined();
    });

    it("renders channel letter B for Booking", () => {
      render(<CalendarLegend showChannels={true} />);
      expect(screen.getByText(/^B$/)).toBeDefined();
      expect(screen.getByText("Booking")).toBeDefined();
    });

    it("renders channel letter V for VRBO", () => {
      render(<CalendarLegend showChannels={true} />);
      expect(screen.getByText(/^V$/)).toBeDefined();
      expect(screen.getByText("VRBO")).toBeDefined();
    });

    it("renders channel letter ? for Otro", () => {
      render(<CalendarLegend showChannels={true} />);
      expect(screen.getByText(/^\?$/)).toBeDefined();
      expect(screen.getByText("Otro")).toBeDefined();
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

  it("does not use rounded-full on any dot element", () => {
    render(<CalendarLegend showChannels={true} />);
    const dots = document.querySelectorAll("span");
    dots.forEach((dot) => {
      expect(dot.className).not.toMatch(/rounded-full/);
    });
  });
});
