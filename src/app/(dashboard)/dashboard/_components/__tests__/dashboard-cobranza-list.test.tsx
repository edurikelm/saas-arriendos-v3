import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  DashboardCobranzaList,
  type CobranzaItem,
} from "../dashboard-cobranza-list";

function expectInDoc(node: Element | null): asserts node is Element {
  expect(node).not.toBeNull();
}

const items: CobranzaItem[] = [
  {
    reservationId: "res-1",
    clientName: "Camila Rojas",
    propertyName: "Cabaña del Lago",
    amount: 400000,
    dueDate: new Date("2026-08-20T12:00:00Z"),
    daysFromToday: -7,
    bucket: "OVERDUE",
  },
  {
    reservationId: "res-2",
    clientName: "Juan Pérez",
    propertyName: "Depto Centro 802",
    amount: 185000,
    dueDate: new Date("2026-08-27T12:00:00Z"),
    daysFromToday: 0,
    bucket: "DUE_TODAY",
  },
  {
    reservationId: "res-3",
    clientName: "Marta Silva",
    propertyName: "Casa Playa Norte",
    amount: 1250000,
    dueDate: new Date("2026-09-01T12:00:00Z"),
    daysFromToday: 5,
    bucket: "UPCOMING_7D",
  },
];

describe("DashboardCobranzaList", () => {
  it("muestra cliente, propiedad y monto de cada cobro", () => {
    render(<DashboardCobranzaList items={items} viewAllHref="/payments" />);

    expectInDoc(screen.queryByText("Camila Rojas"));
    expectInDoc(screen.queryByText("Cabaña del Lago"));
    expectInDoc(screen.queryByText("$400.000"));
  });

  it("distingue vencido / vence hoy / pendiente por label", () => {
    render(<DashboardCobranzaList items={items} viewAllHref="/payments" />);

    expectInDoc(screen.queryByText("Vencido"));
    expectInDoc(screen.queryByText("Vence hoy"));
    expectInDoc(screen.queryByText("Pendiente"));
  });

  it("expresa el vencimiento en términos relativos además de la fecha", () => {
    render(<DashboardCobranzaList items={items} viewAllHref="/payments" />);

    expectInDoc(screen.queryByText(/Venció hace 7 días/));
    expectInDoc(screen.queryByText(/Vence en 5 días/));
  });

  it("enlaza cada fila a la reserva correspondiente", () => {
    render(<DashboardCobranzaList items={items} viewAllHref="/payments" />);

    const link = screen.getByRole("link", { name: /Camila Rojas/ });
    expect(link.getAttribute("href")).toBe("/reservations/res-1");
  });

  it("reporta el total real, no la suma de los items visibles", () => {
    render(
      <DashboardCobranzaList
        items={items}
        viewAllHref="/payments"
        totalAmount={5000000}
        totalCount={9}
      />
    );

    expectInDoc(screen.queryByText(/9 cobros/i));
    expectInDoc(screen.queryByText("$5.000.000"));
  });

  it("muestra un empty state cuando no hay cobros", () => {
    render(<DashboardCobranzaList items={[]} viewAllHref="/payments" />);

    expectInDoc(screen.queryByText("Sin cobros pendientes"));
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("maneja daysFromToday null (sin dueDate) sin reventar", () => {
    render(
      <DashboardCobranzaList
        items={[
          {
            reservationId: "res-4",
            clientName: "Pedro Soto",
            propertyName: "Loft Sur",
            amount: 90000,
            dueDate: null,
            daysFromToday: null,
            bucket: "UPCOMING_7D",
          },
        ]}
        viewAllHref="/payments"
      />
    );

    expectInDoc(screen.queryByText("Sin fecha de vencimiento"));
  });
});
