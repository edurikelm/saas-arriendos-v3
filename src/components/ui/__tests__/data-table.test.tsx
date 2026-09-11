import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// ────────────────────────────────────────────────────────────────────────────
// Orden por columna
// ────────────────────────────────────────────────────────────────────────────

describe("DataTable - orden por columna", () => {
  const headers = [
    { label: "Cliente", sortKey: "cliente" },
    "Concepto",
    { label: "Monto", align: "right" as const, sortKey: "monto" },
  ];

  function renderSortable(sort: { key: string; dir: "asc" | "desc" } | null = null) {
    const onSortChange = vi.fn();
    render(
      <DataTable headers={headers} sort={sort} onSortChange={onSortChange}>
        <tr>
          <td>Ana</td>
          <td>Arriendo</td>
          <td>$1.000</td>
        </tr>
      </DataTable>,
    );
    return { onSortChange };
  }

  it("solo las columnas con sortKey son botones", () => {
    renderSortable();

    expect(screen.getByRole("button", { name: /^cliente/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^monto/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /concepto/i })).toBeNull();
  });

  it("sin onSortChange no ordena, aunque haya sortKey", () => {
    // Las variantes de la tabla que no pasan el handler tienen que seguir
    // renderizando cabeceras de texto.
    render(
      <DataTable headers={headers}>
        <tr>
          <td>Ana</td>
        </tr>
      </DataTable>,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("declara el orden en la celda, no en el botón", () => {
    // Es la CELDA la que está ordenada; `aria-sort` va en el `<th>`.
    renderSortable({ key: "monto", dir: "desc" });

    const ths = Array.from(document.querySelectorAll("th"));
    const monto = ths.find((th) => th.textContent?.includes("Monto"));
    const cliente = ths.find((th) => th.textContent?.includes("Cliente"));
    const concepto = ths.find((th) => th.textContent?.includes("Concepto"));

    expect(monto?.getAttribute("aria-sort")).toBe("descending");
    expect(cliente?.getAttribute("aria-sort")).toBe("none");
    // Una columna que no participa del orden NO dice "none".
    expect(concepto?.hasAttribute("aria-sort")).toBe(false);
  });

  it("una columna apagada arranca ascendente", async () => {
    const { onSortChange } = renderSortable(null);

    await userEvent.click(screen.getByRole("button", { name: /^cliente/i }));

    expect(onSortChange).toHaveBeenCalledWith({ key: "cliente", dir: "asc" });
  });

  it("ascendente pasa a descendente", async () => {
    const { onSortChange } = renderSortable({ key: "cliente", dir: "asc" });

    await userEvent.click(screen.getByRole("button", { name: /^cliente/i }));

    expect(onSortChange).toHaveBeenCalledWith({ key: "cliente", dir: "desc" });
  });

  it("descendente apaga el orden y devuelve null", async () => {
    // El tercer click vuelve al orden por defecto del caller, no a un tercer
    // orden inventado.
    const { onSortChange } = renderSortable({ key: "cliente", dir: "desc" });

    await userEvent.click(screen.getByRole("button", { name: /^cliente/i }));

    expect(onSortChange).toHaveBeenCalledWith(null);
  });

  it("cambiar de columna arranca ascendente, sin heredar la dirección", async () => {
    const { onSortChange } = renderSortable({ key: "cliente", dir: "desc" });

    await userEvent.click(screen.getByRole("button", { name: /^monto/i }));

    expect(onSortChange).toHaveBeenCalledWith({ key: "monto", dir: "asc" });
  });

  it("el nombre accesible empieza por la etiqueta y dice qué hace el click", () => {
    // WCAG 2.5.3: quien dicta "Monto" tiene que poder accionarlo.
    renderSortable({ key: "monto", dir: "asc" });

    expect(screen.getByRole("button", { name: "Monto: ordenar descendente" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cliente: ordenar ascendente" })).toBeTruthy();
  });
});
