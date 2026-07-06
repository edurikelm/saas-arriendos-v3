import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthBadge } from "../health-badge";

describe("HealthBadge semantic token mapping", () => {
  it("maps 'healthy' status to success variant", () => {
    render(<HealthBadge status="healthy" />);
    const badge = screen.getByText("Activo");
    expect(badge.className).toMatch(/bg-success/);
  });

  it("maps 'attention' status to warning variant", () => {
    render(<HealthBadge status="attention" />);
    const badge = screen.getByText("Atención");
    expect(badge.className).toMatch(/bg-warning/);
  });

  it("maps 'overdue' status to destructive variant", () => {
    render(<HealthBadge status="overdue" />);
    const badge = screen.getByText("Vencido");
    expect(badge.className).toMatch(/bg-destructive/);
  });

  it("maps 'dormant' status to secondary variant", () => {
    render(<HealthBadge status="dormant" />);
    const badge = screen.getByText("Inactivo");
    expect(badge.className).toMatch(/bg-secondary/);
  });

  it("renders custom label when provided as children", () => {
    render(<HealthBadge status="overdue">Sin propiedades</HealthBadge>);
    const badge = screen.getByText("Sin propiedades");
    expect(badge.className).toMatch(/bg-destructive/);
  });

  it("applies rounded-md class (not pill)", () => {
    render(<HealthBadge status="healthy" />);
    const badge = screen.getByText("Activo");
    expect(badge.className).toMatch(/rounded-md/);
  });
});
