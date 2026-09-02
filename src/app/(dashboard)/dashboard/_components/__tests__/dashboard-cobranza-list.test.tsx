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

  it("no repite el estado visualmente en cada fila", () => {
    render(<DashboardCobranzaList items={items} viewAllHref="/payments" />);

    // El label del bucket existe en el DOM, pero solo para lectores de
    // pantalla: nada de pill ni texto tenido repitiendo lo que ya dice el
    // encabezado del grupo.
    expect(screen.getByText("Vencido").className).toContain("sr-only");
    expect(screen.getByText("Pendiente").className).toContain("sr-only");
  });

  // El nombre accesible del link se calcula del CONTENIDO de la fila. La
  // version anterior ponia un aria-label en el <Link>, que lo REEMPLAZA en
  // vez de complementarlo: se anunciaba "cliente — monto — estado" y
  // desaparecian propiedad, tipo de arriendo y linea de vencimiento (#237).
  // Cada query de abajo falla con ese aria-label puesto.
  it("expone toda la fila en el nombre accesible del link, no solo cliente y monto", () => {
    render(<DashboardCobranzaList items={items} viewAllHref="/payments" />);

    // Propiedad y tipo de arriendo (la fila los muestra en una sola linea).
    expectInDoc(screen.queryByRole("link", { name: /Cabaña del Lago · Mensual/ }));
    // Linea de vencimiento — el dato accionable.
    expectInDoc(screen.queryByRole("link", { name: /Venció hace 7 días/ }));
    // Y el estado del bucket sigue presente, sin depender del encabezado.
    expectInDoc(screen.queryByRole("link", { name: /Vencido/ }));
    expectInDoc(screen.queryByRole("link", { name: /Pendiente/ }));
  });

  // WCAG 1.4.11: el indicador de foco no puede ser solo un cambio de fondo
  // —medía ~1.04:1 contra el card— y menos si es la MISMA clase que hover,
  // que deja a un usuario de teclado sin forma de distinguirlos.
  it("da un indicador de foco propio a las filas, no solo el fondo de hover", () => {
    render(<DashboardCobranzaList items={items} viewAllHref="/payments" />);

    const link = screen.getByRole("link", { name: /Camila Rojas/ });
    expect(link.className).toContain("focus-visible:outline-[color:var(--foreground)]!");
    expect(link.className).not.toContain("focus-visible:outline-none");
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

  // Los subtotales cubren la ventana completa mientras las filas vienen
  // truncadas, asi que el card tiene que decir cuanto no esta mostrando —
  // si no, el footer queda mayor que la suma visible sin explicacion (#238).
  it("anuncia los cobros truncados de un grupo con '+N cobros mas'", () => {
    render(
      <DashboardCobranzaList
        items={items}
        viewAllHref="/payments"
        groupTotals={{
          OVERDUE: { amount: 3750000, count: 8, hiddenAmount: 1850000, hiddenCount: 5 },
          DUE_SOON: { amount: 410000, count: 2, hiddenAmount: 0, hiddenCount: 0 },
        }}
      />
    );

    expectInDoc(screen.queryByText(/\+5 cobros más · \$1\.850\.000/));
  });

  // Antes, un grupo sin filas visibles se filtraba entero: con 4+ reservas
  // vencidas "Por vencer" desaparecia y su plata solo aparecia en el footer.
  it("renderiza el encabezado de un grupo con subtotal > 0 aunque no tenga filas visibles", () => {
    const soloVencidos = items.filter((item) => item.bucket === "OVERDUE");

    render(
      <DashboardCobranzaList
        items={soloVencidos}
        viewAllHref="/payments"
        groupTotals={{
          OVERDUE: { amount: 400000, count: 1, hiddenAmount: 0, hiddenCount: 0 },
          DUE_SOON: { amount: 560000, count: 2, hiddenAmount: 560000, hiddenCount: 2 },
        }}
      />
    );

    expectInDoc(screen.queryByRole("heading", { name: "Por vencer · 2" }));
    expectInDoc(screen.queryByText(/\+2 cobros más · \$560\.000/));
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
