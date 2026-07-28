import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable } from "../data-table";

describe("DataTable", () => {
  it("renders headers", () => {
    render(
      <DataTable headers={["Nombre", "Email", "Estado"]}>
        <tr><td>Test</td></tr>
      </DataTable>
    );

    expect(screen.getByText("Nombre")).toBeDefined();
    expect(screen.getByText("Email")).toBeDefined();
    expect(screen.getByText("Estado")).toBeDefined();
  });

  it("renders children", () => {
    render(
      <DataTable headers={["Nombre"]}>
        <tr><td>Juan Pérez</td></tr>
      </DataTable>
    );

    expect(screen.getByText("Juan Pérez")).toBeDefined();
  });

  it("renders emptyState when no children", () => {
    render(
      <DataTable
        headers={["Nombre"]}
        emptyState={<div>No hay datos</div>}
      />
    );

    expect(screen.getByText("No hay datos")).toBeDefined();
  });

  it("renders with caption", () => {
    render(
      <DataTable
        headers={["Nombre"]}
        caption="Lista de usuarios"
      >
        <tr><td>Test</td></tr>
      </DataTable>
    );

    expect(document.querySelector("caption")?.textContent).toBe("Lista de usuarios");
  });

  it("applies per-column alignment from header objects", () => {
    render(
      <DataTable
        headers={[
          { label: "Cliente", align: "left" },
          { label: "Monto", align: "right" },
          { label: "Acciones", align: "center" },
        ]}
      >
        <tr><td>Test</td></tr>
      </DataTable>
    );

    const ths = document.querySelectorAll("th");
    expect(ths[0].className).toContain("text-left");
    expect(ths[1].className).toContain("text-right");
    expect(ths[2].className).toContain("text-center");
  });

  it("defaults string headers to text-left alignment", () => {
    render(
      <DataTable headers={["A", "B", "C"]}>
        <tr><td>Test</td></tr>
      </DataTable>
    );

    document.querySelectorAll("th").forEach((th) => {
      expect(th.className).toContain("text-left");
    });
  });

  it("applies minWidth to the table element (horizontal scroll on mobile)", () => {
    const { container } = render(
      <DataTable headers={["A", "B"]}>
        <tr><td>Test</td></tr>
      </DataTable>
    );
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(table!.style.minWidth).toBe("640px");
  });

  it("allows overriding minWidth via prop", () => {
    const { container } = render(
      <DataTable headers={["A"]} minWidth="800px">
        <tr><td>Test</td></tr>
      </DataTable>
    );
    const table = container.querySelector("table");
    expect(table!.style.minWidth).toBe("800px");
  });
});
