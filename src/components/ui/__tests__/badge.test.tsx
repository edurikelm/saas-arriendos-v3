import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../badge";

describe("Badge radius (ADR-0016)", () => {
  it("uses a rectangular chip radius (rounded-md) instead of a pill radius", () => {
    render(<Badge data-testid="badge">Activo</Badge>);

    const badge = screen.getByTestId("badge");
    const className = badge.className;

    expect(className).toContain("rounded-md");
  });

  it("does not use the pill-style rounded-4xl radius", () => {
    render(<Badge data-testid="badge">Activo</Badge>);

    const badge = screen.getByTestId("badge");
    const tokens = badge.className.split(/\s+/);

    expect(tokens).not.toContain("rounded-4xl");
  });

  it("does not use rounded-full on the badge body", () => {
    render(<Badge data-testid="badge">Activo</Badge>);

    const badge = screen.getByTestId("badge");
    const tokens = badge.className.split(/\s+/);

    expect(tokens).not.toContain("rounded-full");
  });
});
