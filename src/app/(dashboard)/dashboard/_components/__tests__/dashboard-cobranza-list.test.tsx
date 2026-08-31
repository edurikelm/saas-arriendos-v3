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
    billingType: "MONTHLY",
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
    billingType: "DAILY",
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
    billingType: "MONTHLY",
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
    expectInDoc(screen.queryByText(/Cabaña del Lago/));
    // Sin `groupTotals`, el subtotal del grupo se deriva de los items
    // visibles — con un solo cobro vencido coincide con el monto de la fila,
    // asi que el importe aparece dos veces (encabezado + fila).
    expect(screen.getAllByText("$400.000").length).toBeGreaterThan(0);
  });

  // El estado dejo de repetirse por fila (pill + monto tenido + texto
  // tenido): ahora lo dice UNA vez el encabezado del grupo que contiene la
  // fila. Los tres buckets del dominio se agrupan en dos encabezados.
  it("agrupa los cobros bajo un encabezado de urgencia por grupo", () => {
    render(<DashboardCobranzaList items={items} viewAllHref="/payments" />);

    expectInDoc(screen.queryByRole("heading", { name: /Vencidos/ }));
    expectInDoc(screen.queryByRole("heading", { name: /Por vencer/ }));
  });

  it("no repite el estado como pill en cada fila", () => {
    render(<DashboardCobranzaList items={items} viewAllHref="/payments" />);

    expect(screen.queryByText("Vencido")).toBeNull();
    expect(screen.queryByText("Pendiente")).toBeNull();
  });

  // El estado exacto por fila (incluida la distincion "vence hoy" vs
  // "pendiente", que el encabezado fusiona) sigue disponible para lectores
  // de pantalla via el aria-label del link.
  it("preserva el estado exacto de cada fila en el aria-label", () => {
    render(<DashboardCobranzaList items={items} viewAllHref="/payments" />);

    expectInDoc(screen.queryByRole("link", { name: /Juan Perez|Juan Pérez/ }));
    expect(
      screen.getByRole("link", { name: /Camila Rojas/ }).getAttribute("aria-label")
    ).toContain("Vencido");
    expect(
      screen.getByRole("link", { name: /Marta Silva/ }).getAttribute("aria-label")
    ).toContain("Pendiente");
  });

  it("muestra el tipo de arriendo junto a la propiedad", () => {
    render(<DashboardCobranzaList items={items} viewAllHref="/payments" />);

    expectInDoc(screen.queryByText(/Cabaña del Lago · Mensual/));
    expectInDoc(screen.queryByText(/Depto Centro 802 · Diaria/));
  });

  // Los subtotales por grupo cubren la ventana completa, no los items
  // visibles — mismo criterio que el footer. Derivarlos de `items` mentiria
  // en cuanto hay mas cobros de los que caben en el card.
  it("usa los subtotales de grupo provistos, no la suma de los items visibles", () => {
    render(
      <DashboardCobranzaList
        items={items}
        viewAllHref="/payments"
        groupTotals={{
          OVERDUE: { amount: 3750000, count: 4 },
          DUE_SOON: { amount: 410000, count: 2 },
        }}
      />
    );

    expectInDoc(screen.queryByRole("heading", { name: "Vencidos · 4" }));
    expectInDoc(screen.queryByText("$3.750.000"));
    expectInDoc(screen.queryByRole("heading", { name: "Por vencer · 2" }));
    expectInDoc(screen.queryByText("$410.000"));
  });

  it("deriva el subtotal de grupo de los items visibles cuando no se provee", () => {
    render(<DashboardCobranzaList items={items} viewAllHref="/payments" />);

    expectInDoc(screen.queryByRole("heading", { name: "Vencidos · 1" }));
    expectInDoc(screen.queryByRole("heading", { name: "Por vencer · 2" }));
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

  // El footer con el total va siempre al fondo de la card, incluso sin
  // cobros — el dueño no debería inferir el estado de su cartera por la
  // ausencia de ese bloque.
  it("el total sigue en el fondo de la card aunque no haya cobros", () => {
    render(<DashboardCobranzaList items={[]} viewAllHref="/payments" />);

    expectInDoc(screen.queryByText(/0 cobros/i));
    expectInDoc(screen.queryByText("$0"));
  });

  it("maneja daysFromToday null (sin dueDate) sin reventar", () => {
    render(
      <DashboardCobranzaList
        items={[
          {
            reservationId: "res-4",
            clientName: "Pedro Soto",
            propertyName: "Loft Sur",
            billingType: "MONTHLY",
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
            billingType: "MONTHLY",
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
              billingType: "MONTHLY",
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
            billingType: "MONTHLY",
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
            billingType: "MONTHLY",
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
