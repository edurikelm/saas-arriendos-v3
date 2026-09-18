import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrokerCommissionsTable } from "../broker-commissions-table";
import type {
  BrokerCommissionRow,
  ReservationCommissionRow,
} from "@/lib/brokers/commission";

const ana: BrokerCommissionRow = {
  brokerId: "brk-1",
  brokerName: "Ana Rojas",
  collectedAmount: 800_000,
  commission: 68_000,
  paymentCount: 3,
  reservationCount: 2,
};

const beto: BrokerCommissionRow = {
  brokerId: "brk-2",
  brokerName: "Beto Sanhueza",
  collectedAmount: 200_000,
  commission: 10_000,
  paymentCount: 1,
  reservationCount: 1,
};

const anaDetail: ReservationCommissionRow[] = [
  {
    reservationId: "res-1",
    commissionRate: 8.5,
    collectedAmount: 600_000,
    commission: 51_000,
    paymentCount: 2,
    clientName: "Juan Pérez",
    propertyName: "Departamento Centro",
    startDateKey: "2026-09-05",
    endDateKey: "2026-09-12",
  },
  {
    reservationId: "res-2",
    commissionRate: 8.5,
    collectedAmount: 200_000,
    commission: 17_000,
    paymentCount: 1,
    clientName: "María García",
    propertyName: "Cabaña Lago",
    startDateKey: "2026-09-20",
    endDateKey: "2026-09-25",
  },
];

function renderTable(rows: BrokerCommissionRow[] = [ana, beto]) {
  return render(
    <BrokerCommissionsTable
      rows={rows}
      reservationsByBroker={{ "brk-1": anaDetail, "brk-2": [] }}
      totalCommission={rows.reduce((t, r) => t + r.commission, 0)}
    />,
  );
}

describe("BrokerCommissionsTable", () => {
  it("lista cada captador con su comisión del período", () => {
    renderTable();

    expect(screen.getByText("Ana Rojas")).toBeDefined();
    expect(screen.getByText("Beto Sanhueza")).toBeDefined();
    expect(screen.getByText("$68.000")).toBeDefined();
    expect(screen.getByText("$10.000")).toBeDefined();
  });

  it("rotula que lo cobrado es de las reservas del captador, no la caja del período", () => {
    // Si dijera solo "Cobrado", se leería como la caja total y no cuadraría
    // con el KPI de arriba.
    renderTable();

    expect(screen.getByText("Cobrado de sus reservas")).toBeDefined();
  });

  it("suma el total al pie", () => {
    renderTable();

    expect(screen.getByText("Total")).toBeDefined();
    expect(screen.getByText("$78.000")).toBeDefined();
  });

  it("el detalle por reserva arranca cerrado", () => {
    renderTable();

    expect(screen.queryByText("Juan Pérez")).toBeNull();
  });

  it("abre el detalle con la reserva, la propiedad y las fechas", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByText("Ana Rojas"));

    expect(screen.getByText("Juan Pérez")).toBeDefined();
    expect(screen.getByText(/Departamento Centro/)).toBeDefined();
    expect(screen.getByText("$51.000")).toBeDefined();
    // La tasa congelada de esa reserva, formateada con coma.
    expect(screen.getAllByText("8,5%").length).toBeGreaterThan(0);
  });

  it("cerrar el detalle lo vuelve a esconder", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByText("Ana Rojas"));
    await user.click(screen.getByText("Ana Rojas"));

    expect(screen.queryByText("Juan Pérez")).toBeNull();
  });

  it("sin cobros del período muestra el estado vacío", () => {
    renderTable([]);

    expect(
      screen.getByText("Ninguna reserva con captador cobró en este período"),
    ).toBeDefined();
  });
});
