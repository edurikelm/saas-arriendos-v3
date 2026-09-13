import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let currentQuery = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(currentQuery),
}));

import { AdminSupportList } from "../admin-support-list";

/**
 * Select REAL de Base UI: los filtros llegan de la URL como enum y el
 * disparador tiene que traducirlos. Con `<SelectValue placeholder="Todas" />`
 * mostraba "HIGH", "PAYMENTS" o "all" —el placeholder solo aparece sin valor, y
 * aquí siempre hay uno—.
 */
describe("AdminSupportList — disparadores de filtro", () => {
  beforeEach(() => {
    currentQuery = "";
  });

  it("sin filtros, ambos disparadores dicen Todas en vez de 'all'", () => {
    render(<AdminSupportList tickets={[]} total={0} />);

    const prioridad = screen.getByRole("combobox", { name: /prioridad/i });
    const categoria = screen.getByRole("combobox", { name: /categoría/i });
    expect(prioridad.textContent).toContain("Todas");
    expect(categoria.textContent).toContain("Todas");
    expect(prioridad.textContent).not.toContain("all");
  });

  it("con filtros en la URL, muestra la etiqueta en español", () => {
    currentQuery = "priority=HIGH&category=PAYMENTS";
    render(<AdminSupportList tickets={[]} total={0} />);

    expect(screen.getByRole("combobox", { name: /prioridad/i }).textContent).toContain("Alta");
    expect(screen.getByRole("combobox", { name: /categoría/i }).textContent).toContain("Pagos");
    expect(screen.queryByText("HIGH")).toBeNull();
    expect(screen.queryByText("PAYMENTS")).toBeNull();
  });
});
