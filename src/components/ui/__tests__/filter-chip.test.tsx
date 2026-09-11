import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterChip } from "../filter-chip";
import { DropdownMenuContent, DropdownMenuItem } from "../dropdown-menu";

function renderChip(props: Partial<React.ComponentProps<typeof FilterChip>> = {}) {
  const onClear = vi.fn();
  render(
    <FilterChip label="Propiedad" value={null} onClear={onClear} {...props}>
      <DropdownMenuContent>
        <DropdownMenuItem>Casa Central</DropdownMenuItem>
      </DropdownMenuContent>
    </FilterChip>,
  );
  return { onClear };
}

describe("FilterChip", () => {
  it("apagado muestra solo el nombre de la dimensión", () => {
    renderChip();

    expect(screen.getByRole("button", { name: /propiedad/i }).textContent?.trim()).toBe("Propiedad");
  });

  it("activo muestra la dimensión Y el valor", () => {
    // El nombre no se reemplaza: un chip que solo dice "Casa Central" no dice
    // qué se está filtrando.
    renderChip({ value: "prop-1", valueLabel: "Casa Central" });

    const chip = screen.getByRole("button", { name: /casa central/i });
    expect(chip.textContent).toContain("Propiedad");
    expect(chip.textContent).toContain("Casa Central");
  });

  it("apagado no renderiza botón de limpiar", () => {
    renderChip();

    expect(screen.queryByRole("button", { name: /quitar filtro/i })).toBeNull();
  });

  it("deriva la etiqueta del limpiar desde el nombre de la dimensión", () => {
    renderChip({ value: "prop-1", valueLabel: "Casa Central" });

    expect(screen.getByRole("button", { name: "Quitar filtro de propiedad" })).toBeTruthy();
  });

  it("acepta una etiqueta de limpiar propia", () => {
    renderChip({ value: "x", valueLabel: "Algo", clearAriaLabel: "Quitar el filtro de cobranza" });

    expect(screen.getByRole("button", { name: "Quitar el filtro de cobranza" })).toBeTruthy();
  });

  it("limpiar avisa al caller", async () => {
    const { onClear } = renderChip({ value: "prop-1", valueLabel: "Casa Central" });

    await userEvent.click(screen.getByRole("button", { name: /quitar filtro/i }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("el botón de limpiar es HERMANO del disparador, no está anidado", () => {
    // Anidar un `button` dentro del `DropdownMenuTrigger` produce HTML inválido
    // y deja la acción inalcanzable por teclado.
    renderChip({ value: "prop-1", valueLabel: "Casa Central" });

    const limpiar = screen.getByRole("button", { name: /quitar filtro/i });
    const disparador = screen.getByRole("button", { name: /casa central/i });

    expect(disparador.contains(limpiar)).toBe(false);
    expect(limpiar.parentElement).toBe(disparador.parentElement);
  });

  it("el valor largo se puede acotar sin estirar la fila", () => {
    renderChip({
      value: "prop-1",
      valueLabel: "Departamento Vista al Mar Nueva Las Condes 300",
      valueMaxWidth: "max-w-[140px]",
    });

    const valor = screen.getByText("Departamento Vista al Mar Nueva Las Condes 300");
    expect(valor.className).toContain("max-w-[140px]");
    expect(valor.className).toContain("truncate");
  });
});
