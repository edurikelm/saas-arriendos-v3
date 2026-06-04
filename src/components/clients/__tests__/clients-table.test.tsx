import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/actions/clients", () => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
}));

import { ClientsTable } from "../clients-table";

const mockClient = {
  id: "1",
  name: "Juan Pérez",
  email: "juan@test.com",
  phone: "+56912345678",
  rut: "12.345.678-9",
  notes: null,
  reservationsCount: 2,
  createdAt: "2025-01-01T00:00:00.000Z",
  userId: "user-1",
};

function createFetchMock(responseData: object) {
  return vi.fn().mockResolvedValue({
    json: () => Promise.resolve(responseData),
  });
}

describe("ClientsTable pagination", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        data: [mockClient],
        total: 25,
        page: 1,
        totalPages: 2,
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza los datos iniciales", () => {
    const initialData = {
      data: [mockClient],
      total: 1,
      page: 1,
      totalPages: 1,
    };

    render(<ClientsTable initialData={initialData} />);

    expect(screen.getByText("Juan Pérez")).toBeDefined();
    expect(screen.getByText("juan@test.com")).toBeDefined();
  });

  it("muestra paginación cuando total > limit", () => {
    const initialData = {
      data: [mockClient],
      total: 25,
      page: 1,
      totalPages: 2,
    };

    render(<ClientsTable initialData={initialData} />);

    expect(screen.getByText("Siguiente")).toBeDefined();
    expect(screen.getByText("Anterior")).toBeDefined();
  });

  it("no muestra paginación cuando total <= limit", () => {
    const initialData = {
      data: [mockClient],
      total: 1,
      page: 1,
      totalPages: 1,
    };

    render(<ClientsTable initialData={initialData} />);

    expect(screen.queryByText("Siguiente")).toBeNull();
    expect(screen.queryByText("Anterior")).toBeNull();
  });

  it("muestra el rango de resultados", () => {
    const initialData = {
      data: [mockClient],
      total: 25,
      page: 1,
      totalPages: 2,
    };

    render(<ClientsTable initialData={initialData} />);

    const matches = screen.getAllByText(/Mostrando 1-10 de 25/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
