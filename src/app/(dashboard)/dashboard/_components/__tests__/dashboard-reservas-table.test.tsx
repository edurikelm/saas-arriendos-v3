import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardReservasTable } from "../dashboard-reservas-table";

function expectInDoc(node: Element | null): asserts node is Element {
  expect(node).not.toBeNull();
}

const proximasRows = (
  <tr>
    <td>Cabaña del Lago</td>
    <td>Camila Rojas</td>
    <td>1 sept - 5 sept</td>
    <td>Diaria</td>
    <td>Próxima</td>
    <td>$120.000</td>
  </tr>
);

const activasRows = (
  <tr>
    <td>Depto Centro 802</td>
    <td>Juan Pérez</td>
    <td>20 ago - 30 ago</td>
    <td>Mensual</td>
    <td>Activa</td>
    <td>$300.000</td>
  </tr>
);

const emptyProximas = <p>Sin reservas próximas</p>;
const emptyActivas = <p>Sin reservas activas</p>;

function renderTable(overrides: Partial<Parameters<typeof DashboardReservasTable>[0]> = {}) {
  return render(
    <DashboardReservasTable
      title="Agenda de reservas"
      viewAllHref="/reservations"
      proximas={proximasRows}
      activas={activasRows}
      emptyProximas={emptyProximas}
      emptyActivas={emptyActivas}
      {...overrides}
    />,
  );
}

describe("DashboardReservasTable", () => {
  it("por defecto monta la vista Próximas", () => {
    renderTable();

    expectInDoc(screen.queryByText("Camila Rojas"));
    expect(screen.queryByText("Juan Pérez")).toBeNull();
  });

  it("al hacer click en Activas monta las filas de activas y deja de mostrar las de próximas", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Activas" }));

    expectInDoc(screen.queryByText("Juan Pérez"));
    expect(screen.queryByText("Camila Rojas")).toBeNull();
  });

  it("aria-pressed refleja la vista activa en ambos botones", async () => {
    const user = userEvent.setup();
    renderTable();

    const proximasButton = screen.getByRole("button", { name: "Próximas" });
    const activasButton = screen.getByRole("button", { name: "Activas" });

    expect(proximasButton.getAttribute("aria-pressed")).toBe("true");
    expect(activasButton.getAttribute("aria-pressed")).toBe("false");

    await user.click(activasButton);

    expect(proximasButton.getAttribute("aria-pressed")).toBe("false");
    expect(activasButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("cada vista muestra su propio empty state cuando no tiene filas", async () => {
    const user = userEvent.setup();
    renderTable({ proximas: [], activas: [] });

    expectInDoc(screen.queryByText("Sin reservas próximas"));

    await user.click(screen.getByRole("button", { name: "Activas" }));

    expectInDoc(screen.queryByText("Sin reservas activas"));
    expect(screen.queryByText("Sin reservas próximas")).toBeNull();
  });

  it("enlaza el link Ver todas al href provisto", () => {
    renderTable({ viewAllHref: "/reservations" });

    const link = screen.getByRole("link", { name: "Ver todas" });
    expect(link.getAttribute("href")).toBe("/reservations");
  });

  it("muestra el título como heading de sección", () => {
    renderTable({ title: "Agenda de reservas" });

    expectInDoc(screen.queryByRole("heading", { name: "Agenda de reservas" }));
  });
});
