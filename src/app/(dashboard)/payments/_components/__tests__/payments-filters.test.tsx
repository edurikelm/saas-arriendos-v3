import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
