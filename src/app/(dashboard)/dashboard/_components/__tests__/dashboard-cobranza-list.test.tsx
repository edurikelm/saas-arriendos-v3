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
    overdueCount: 1,
    dueSoonCount: 0,
    dueSoonDaysFromToday: null,
  },
  {
    reservationId: "res-2",
    clientName: "Juan Pérez",
    propertyName: "Depto Centro 802",
    amount: 185000,
    dueDate: new Date("2026-08-27T12:00:00Z"),
    daysFromToday: 0,
    bucket: "DUE_TODAY",
    overdueCount: 0,
    dueSoonCount: 0,
    dueSoonDaysFromToday: null,
  },
  {
    reservationId: "res-3",
    clientName: "Marta Silva",
    propertyName: "Casa Playa Norte",
    amount: 1250000,
    dueDate: new Date("2026-09-01T12:00:00Z"),
    daysFromToday: 5,
    bucket: "UPCOMING_7D",
    overdueCount: 0,
    dueSoonCount: 0,
    dueSoonDaysFromToday: null,
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
            overdueCount: 0,
            dueSoonCount: 0,
            dueSoonDaysFromToday: null,
          },
        ]}
        viewAllHref="/payments"
      />
    );

    expectInDoc(screen.queryByText("Sin fecha de vencimiento"));
  });

  // El sufijo "+N ..." se renderiza como chip separado del texto principal
  // (no concatenado en un solo nodo de texto): un texto corrido de 38+
  // caracteres a `text-[10px]` en la columna angosta del card desbordaba a
  // 2-3 líneas. El chip envuelve como unidad en vez de partirse.
  it("una reserva con varias cuotas vencidas y una por vencer separa ambos tramos en nodos distintos", () => {
    render(
      <DashboardCobranzaList
        items={[
          {
            reservationId: "res-5",
            clientName: "Alejandra Mayorga",
            propertyName: "Teja 2",
            amount: 750000,
            dueDate: new Date("2026-07-01T00:00:00Z"),
            daysFromToday: -58,
            bucket: "OVERDUE",
            overdueCount: 2,
            dueSoonCount: 1,
            dueSoonDaysFromToday: 4,
          },
        ]}
        viewAllHref="/payments"
      />
    );

    expectInDoc(screen.queryByText("2 cuotas vencidas"));
    expectInDoc(screen.queryByText("+1 vence en 4 días"));
  });

  // `generateMonthlyPayments` fija todos los `dueDate` al día 1, así que
  // `dueSoonDaysFromToday` vale 0 cada día 1 y 1 cada último día de mes:
  // son los dos valores más frecuentes de la ventana, no bordes raros.
  it.each([
    [0, "+1 vence hoy"],
    [1, "+1 vence mañana"],
  ])(
    "dueSoonDaysFromToday = %i no produce «en N días» sino la escalera relativa",
    (dueSoonDaysFromToday, expectedChip) => {
      render(
        <DashboardCobranzaList
          items={[
            {
              reservationId: "res-6",
              clientName: "Alejandra Mayorga",
              propertyName: "Teja 2",
              amount: 750000,
              dueDate: new Date("2026-07-01T00:00:00Z"),
              daysFromToday: -62,
              bucket: "OVERDUE",
              overdueCount: 2,
              dueSoonCount: 1,
              dueSoonDaysFromToday,
            },
          ]}
          viewAllHref="/payments"
        />
      );

      expectInDoc(screen.queryByText(expectedChip));
    }
  );

  it("pluraliza el verbo del chip cuando vencen varias cuotas", () => {
    render(
      <DashboardCobranzaList
        items={[
          {
            reservationId: "res-7",
            clientName: "Alejandra Mayorga",
            propertyName: "Teja 2",
            amount: 1000000,
            dueDate: new Date("2026-07-01T00:00:00Z"),
            daysFromToday: -62,
            bucket: "OVERDUE",
            overdueCount: 2,
            dueSoonCount: 2,
            dueSoonDaysFromToday: 0,
          },
        ]}
        viewAllHref="/payments"
      />
    );

    expectInDoc(screen.queryByText("+2 vencen hoy"));
  });

  it("sin cuotas por vencer, la fila vencida no renderiza chip", () => {
    render(
      <DashboardCobranzaList
        items={[
          {
            reservationId: "res-8",
            clientName: "Alejandra Mayorga",
            propertyName: "Teja 2",
            amount: 500000,
            dueDate: new Date("2026-07-01T00:00:00Z"),
            daysFromToday: -58,
            bucket: "OVERDUE",
            overdueCount: 2,
            dueSoonCount: 0,
            dueSoonDaysFromToday: null,
          },
        ]}
        viewAllHref="/payments"
      />
    );

    expectInDoc(screen.queryByText(/desde 1 jul/i));
    expect(screen.queryByText(/vence/i)).toBeNull();
  });
});
