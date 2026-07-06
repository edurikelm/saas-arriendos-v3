import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardNavbar } from "../dashboard-navbar";

describe("DashboardNavbar", () => {
  it("renders the eyebrow text", () => {
    render(<DashboardNavbar />);
    const eyebrow = screen.getByText("Panel de Administración");
    expect(eyebrow).not.toBeNull();
  });

  it("renders the search input", () => {
    render(<DashboardNavbar />);
    const searchInput = screen.getByPlaceholderText("Buscar...");
    expect(searchInput).not.toBeNull();
  });

  it("renders the Bell icon button", () => {
    render(<DashboardNavbar />);
    const bellButtons = screen.getAllByRole("button");
    expect(bellButtons.length).toBeGreaterThan(0);
  });
});
