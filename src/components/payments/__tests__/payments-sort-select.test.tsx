import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentsSortSelect, PAYMENTS_SORT_OPTIONS } from "../payments-sort-select";

function renderSelect(sort: { key: string; dir: "asc" | "desc" } | null = null) {
  const onSortChange = vi.fn();
  render(<PaymentsSortSelect sort={sort} onSortChange={onSortChange} />);
  return { onSortChange };
}

/** Abre el chip. El popup de Base UI monta asíncrono: consultar con `findBy*`. */
async function abrir() {
  await userEvent.click(screen.getByRole("button", { name: /^orden/i }));
}

describe("PaymentsSortSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("con el orden por defecto muestra solo la dimensión", () => {
    renderSelect(null);

    expect(screen.getByRole("button", { name: /^orden$/i })).toBeTruthy();
  });

  it("con el orden por defecto no ofrece limpiarlo", () => {
    // No hay nada que quitar.
    renderSelect(null);

    expect(screen.queryByRole("button", { name: /volver al orden por defecto/i })).toBeNull();
  });

  it("nombra el orden activo por su resultado", () => {
    renderSelect({ key: "monto", dir: "desc" });

    expect(screen.getByText("Monto: mayor primero")).toBeTruthy();
  });

  it("ofrece todas las combinaciones que el servidor acepta", async () => {
    renderSelect(null);
    await abrir();

    for (const opcion of PAYMENTS_SORT_OPTIONS) {
      expect(await screen.findByRole("menuitem", { name: opcion.label })).toBeTruthy();
    }
  });

  it("elegir una opción avisa la columna y la dirección", async () => {
    const { onSortChange } = renderSelect(null);
    await abrir();

    await userEvent.click(await screen.findByRole("menuitem", { name: "Cliente A-Z" }));

    expect(onSortChange).toHaveBeenCalledWith({ key: "cliente", dir: "asc" });
  });

  it('"Más recientes" devuelve null, el orden por defecto del servidor', async () => {
    const { onSortChange } = renderSelect({ key: "monto", dir: "asc" });
    await abrir();

    await userEvent.click(await screen.findByRole("menuitem", { name: "Más recientes" }));

    expect(onSortChange).toHaveBeenCalledWith(null);
  });

  it("limpiar vuelve al orden por defecto", async () => {
    const { onSortChange } = renderSelect({ key: "cliente", dir: "desc" });

    await userEvent.click(screen.getByRole("button", { name: /volver al orden por defecto/i }));

    expect(onSortChange).toHaveBeenCalledWith(null);
  });

  it("las etiquetas de estado nombran qué queda primero, sin prometer un A-Z", () => {
    // El enum de Postgres ordena por su orden de DECLARACIÓN —PENDING,
    // COMPLETED, FAILED—, no alfabéticamente. Verificado contra la base.
    const estado = PAYMENTS_SORT_OPTIONS.filter((o) => o.sort?.key === "estado");

    expect(estado.map((o) => o.label)).toEqual([
      "Estado: pendientes primero",
      "Estado: fallidos primero",
    ]);
    expect(estado.some((o) => /a-z/i.test(o.label))).toBe(false);
  });

  it("un orden que la lista no nombra no rompe el chip", async () => {
    // Puede llegar por la URL una combinación sin etiqueta.
    renderSelect({ key: "estado", dir: "asc" });

    expect(screen.getByRole("button", { name: /^orden/i })).toBeTruthy();
  });
});
