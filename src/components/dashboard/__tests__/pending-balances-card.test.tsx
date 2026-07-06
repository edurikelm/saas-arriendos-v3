import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PendingBalancesCard } from "../pending-balances-card";

function expectInDoc(node: Element | null): asserts node is Element {
  expect(node).not.toBeNull();
}

const baseSaldos = [
  {
    reservationId: "res-1",
    reservation: {
      client: { name: "Victor Varas" },
      property: { name: "Regional 3" },
    },
    pending: 50000,
  },
  {
    reservationId: "res-2",
    reservation: {
      client: { name: "Maria Lopez" },
      property: { name: "Depto Centro" },
    },
    pending: 75000,
  },
];

describe("PendingBalancesCard", () => {
  it("muestra el saldo total y conteo de reservas", () => {
    render(<PendingBalancesCard saldos={baseSaldos} />);

    expectInDoc(screen.queryByText("$125.000"));
    expectInDoc(screen.queryByText(/2 reservas/i));
  });

  it("muestra cada reserva con su cliente, propiedad y monto", () => {
    render(<PendingBalancesCard saldos={baseSaldos} />);

    expectInDoc(screen.queryByText("Victor Varas"));
    expectInDoc(screen.queryByText("Regional 3"));
    expectInDoc(screen.queryByText("$50.000"));

    expectInDoc(screen.queryByText("Maria Lopez"));
    expectInDoc(screen.queryByText("Depto Centro"));
    expectInDoc(screen.queryByText("$75.000"));
  });

  it("renderiza empty state positivo cuando no hay saldos", () => {
    render(<PendingBalancesCard saldos={[]} />);

    expectInDoc(screen.queryByText(/sin saldos pendientes/i));
  });

  it("pluraliza correctamente 1 reserva vs N", () => {
    const { rerender } = render(<PendingBalancesCard saldos={[baseSaldos[0]]} />);
    expectInDoc(screen.queryByText(/1 reserva$/i));

    rerender(<PendingBalancesCard saldos={baseSaldos} />);
    expectInDoc(screen.queryByText(/2 reservas/i));
  });
});
