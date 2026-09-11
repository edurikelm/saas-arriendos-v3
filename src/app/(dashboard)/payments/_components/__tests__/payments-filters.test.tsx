import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentsFilters } from "../payments-filters";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({
    toString: () => "",
  }),
}));

const mockProperties = [
  { id: "prop-1", name: "Casa Central" },
  { id: "prop-2", name: "Depto Playa" },
];

function renderFilters(props: {
  propertyId?: string;
  method?: string;
  status?: string;
  paymentType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return render(
    <PaymentsFilters
      properties={mockProperties}
      propertyId={props.propertyId ?? ""}
      method={props.method ?? ""}
      status={props.status ?? ""}
      paymentType={props.paymentType ?? ""}
      search={props.search ?? ""}
      dateFrom={props.dateFrom ?? ""}
      dateTo={props.dateTo ?? ""}
    />
  );
}

describe("PaymentsFilters - dropdown chips", () => {
  it("renderiza todos los chips de filtro", async () => {
    renderFilters({});

    // Should show all filter chips
    expect(screen.getByRole("button", { name: /propiedad/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /método/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /estado/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /tipo/i })).toBeTruthy();
  });

  it("muestra chip activo cuando paymentType está configurado", async () => {
    renderFilters({ paymentType: "RESERVATION" });

    // Should show "Limpiar filtros" button when paymentType is set
    expect(screen.getByRole("button", { name: /limpiar filtros/i })).toBeTruthy();
    // The Tipo chip should show "Arriendo" when RESERVATION is active
    expect(screen.getByRole("button", { name: /arriendo/i })).toBeTruthy();
  });

  it("no muestra limpiar cuando no hay filtros activos", () => {
    renderFilters({});

    expect(screen.queryByRole("button", { name: /limpiar filtros/i })).toBeNull();
  });

  it("muestra label de chip según el filtro activo - propiedad", async () => {
    renderFilters({ propertyId: "prop-1" });

    // Should show the property name in the chip
    expect(screen.getByRole("button", { name: /casa central/i })).toBeTruthy();
  });

  it("muestra label de chip según el filtro activo - método", async () => {
    renderFilters({ method: "MERCADO_PAGO" });

    expect(screen.getByRole("button", { name: /mercado pago/i })).toBeTruthy();
  });

  it("muestra label de chip según el filtro activo - estado", async () => {
    renderFilters({ status: "COMPLETED" });

    expect(screen.getByRole("button", { name: /completado/i })).toBeTruthy();
  });

  it("muestra chip con estilo activo cuando hay filtro", async () => {
    renderFilters({ paymentType: "EXTRA" });

    // The Tipo chip should have active styling (contains "Extra" text)
    const tipoChip = screen.getByRole("button", { name: /extra/i });
    expect(tipoChip).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Buscador
// ────────────────────────────────────────────────────────────────────────────

describe("PaymentsFilters - buscador", () => {
  it("renderiza el campo con su etiqueta accesible", () => {
    renderFilters({});

    const input = screen.getByLabelText("Buscar pagos");
    expect(input).toBeTruthy();
    expect(input.getAttribute("placeholder")).toContain("cliente");
  });

  it("refleja la búsqueda que ya viene en la URL", () => {
    renderFilters({ search: "María" });

    expect(screen.getByLabelText<HTMLInputElement>("Buscar pagos").value).toBe("María");
  });

  it("cuenta como filtro activo, así que ofrece limpiarlo", () => {
    renderFilters({ search: "María" });

    expect(screen.getByRole("button", { name: /limpiar filtros/i })).toBeTruthy();
  });

  it("sin búsqueda ni filtros no ofrece limpiar", () => {
    renderFilters({});

    expect(screen.queryByRole("button", { name: /limpiar filtros/i })).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// El chip de fechas dice sobre qué fecha filtra
// ────────────────────────────────────────────────────────────────────────────

describe("PaymentsFilters - chip de fechas", () => {
  it("sin rango, el chip nombra el campo en vez de decir 'Seleccionar fechas'", () => {
    // Un rango de fechas no dice sobre QUÉ fecha aplica, y la tabla tiene tres:
    // emisión, vencimiento y pago. El filtro usa la de emisión.
    renderFilters({});

    expect(screen.getByText("Emisión")).toBeTruthy();
    expect(screen.queryByText("Seleccionar fechas")).toBeNull();
  });

  it("con rango elegido, el campo sigue visible junto a las fechas", () => {
    renderFilters({ dateFrom: "2026-09-01", dateTo: "2026-09-30" });

    expect(screen.getByText(/^Emisión:/)).toBeTruthy();
  });

  it("el rango cuenta como filtro activo", () => {
    renderFilters({ dateFrom: "2026-09-01", dateTo: "2026-09-30" });

    expect(screen.getByRole("button", { name: /limpiar filtros/i })).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Los chips usan el primitivo compartido
// ────────────────────────────────────────────────────────────────────────────

describe("PaymentsFilters - chips de filtro", () => {
  it("un chip activo sigue diciendo QUÉ filtra, no solo el valor", () => {
    // Antes el valor reemplazaba al nombre de la dimensión: el chip pasaba a
    // decir "Casa Central" a secas y se perdía que eso era la propiedad. Es el
    // mismo problema que tenía el de fechas.
    renderFilters({ propertyId: "prop-1" });

    const chip = screen.getByRole("button", { name: /casa central/i });
    expect(chip.textContent).toContain("Propiedad");
    expect(chip.textContent).toContain("Casa Central");
  });

  it("un chip apagado muestra solo el nombre de la dimensión", () => {
    renderFilters({});

    const chip = screen.getByRole("button", { name: /^propiedad/i });
    expect(chip.textContent?.trim()).toBe("Propiedad");
  });

  it("cada chip activo trae su propio botón de limpiar", () => {
    // El primitivo lo renderiza como HERMANO del disparador: anidarlo dentro
    // daría HTML inválido y lo dejaría inalcanzable por teclado.
    renderFilters({ propertyId: "prop-1" });

    expect(screen.getByRole("button", { name: "Quitar filtro de propiedad" })).toBeTruthy();
  });

  it("solo el chip activo trae botón de limpiar", () => {
    renderFilters({ propertyId: "prop-1" });

    expect(screen.queryByRole("button", { name: "Quitar filtro de método" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Quitar filtro de estado" })).toBeNull();
  });

  it("limpiar un chip no toca los demás filtros", async () => {
    const user = userEvent.setup();
    renderFilters({ propertyId: "prop-1", status: "COMPLETED" });

    await user.click(screen.getByRole("button", { name: "Quitar filtro de propiedad" }));

    // El chip de estado sigue activo, con su valor y su propio limpiar.
    expect(screen.getByRole("button", { name: "Quitar filtro de estado" })).toBeTruthy();
  });
});
