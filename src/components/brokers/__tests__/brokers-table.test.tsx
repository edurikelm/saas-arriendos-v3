import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/brokers", () => ({
  createBroker: vi.fn(),
  updateBroker: vi.fn(),
  deleteBroker: vi.fn(),
  setBrokerActive: vi.fn(),
}));

import { BrokersTable } from "../brokers-table";
import type { BrokerRow } from "@/lib/actions/brokers";

const mockBroker: BrokerRow = {
  id: "brk-1",
  name: "Ana Rojas",
  email: "ana@test.com",
  phone: "+56912345678",
  rut: "12.345.678-9",
  defaultCommissionRate: 10,
  active: true,
  notes: null,
  reservationsCount: 2,
  createdAt: "2026-09-01T15:00:00.000Z",
};

function createFetchMock(responseData: object) {
  return vi.fn().mockResolvedValue({
    json: () => Promise.resolve(responseData),
  });
}

function renderTable(brokers: BrokerRow[], total = brokers.length) {
  return render(
    <BrokersTable
      initialData={{ data: brokers, total, page: 1, totalPages: 1 }}
      kpis={{ total, active: 1, reservationsBrought: 2, averageRate: 10 }}
    />,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    createFetchMock({ data: [mockBroker], total: 1, page: 1, totalPages: 1 }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BrokersTable", () => {
  it("muestra el captador con su porcentaje", () => {
    renderTable([mockBroker]);

    expect(screen.getByText("Ana Rojas")).toBeDefined();
    expect(screen.getByText("ana@test.com")).toBeDefined();
    // El porcentaje de la fila y el del KPI promedio: los dos dicen 10%.
    expect(screen.getAllByText("10%").length).toBeGreaterThan(0);
  });

  it("formatea el porcentaje con decimales a la chilena", () => {
    renderTable([{ ...mockBroker, defaultCommissionRate: 8.5 }]);

    expect(screen.getByText("8,5%")).toBeDefined();
  });

  it("marca un captador desactivado sin esconderlo", () => {
    renderTable([{ ...mockBroker, active: false }]);

    expect(screen.getByText("Ana Rojas")).toBeDefined();
    expect(screen.getByText("Inactivo")).toBeDefined();
  });

  it("sin email usa el RUT como segunda línea", () => {
    renderTable([{ ...mockBroker, email: null }]);

    expect(screen.getByText("12.345.678-9")).toBeDefined();
  });

  it("con solo teléfono no afirma que no hay contacto", () => {
    // El teléfono tiene su propia columna: decir "sin contacto" bajo el nombre
    // sería falso.
    renderTable([{ ...mockBroker, email: null, rut: null }]);

    expect(screen.queryByText(/sin contacto/i)).toBeNull();
    expect(screen.getByText("+56912345678")).toBeDefined();
  });

  it("el estado vacío invita a registrar al primero", async () => {
    // La tabla refetchea al montar, así que el estado vacío recién se ve
    // cuando esa respuesta también viene vacía.
    vi.stubGlobal(
      "fetch",
      createFetchMock({ data: [], total: 0, page: 1, totalPages: 0 }),
    );

    renderTable([], 0);

    await waitFor(() => expect(screen.getByText("No hay captadores")).toBeDefined());
    expect(screen.getByText("Crear Captador")).toBeDefined();
  });

  it("muestra las reservas captadas de cada uno", () => {
    renderTable([{ ...mockBroker, reservationsCount: 7 }]);

    expect(screen.getByText("7")).toBeDefined();
  });
});
