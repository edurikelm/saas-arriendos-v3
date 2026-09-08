import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useReservationFilters } from "../use-reservation-filters";

/**
 * Todos los filtros viajan al servidor. El hook ya no filtra nada en cliente,
 * así que lo que hay que verificar es qué le manda al servidor y cuándo.
 */
function setup() {
  const onServerFiltersChange = vi.fn();
  const hook = renderHook(() => useReservationFilters({ onServerFiltersChange }));
  return { ...hook, onServerFiltersChange };
}

const ultimoEnvio = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)?.[0];

describe("useReservationFilters — todo va al servidor", () => {
  it("arranca sin filtros activos y con los defaults explícitos", () => {
    const { result, onServerFiltersChange } = setup();

    expect(result.current.hasActiveFilters).toBe(false);
    expect(ultimoEnvio(onServerFiltersChange)).toEqual({
      propertyId: "",
      billingType: "",
      status: "",
      temporal: "all",
      payment: "all",
      search: "",
    });
  });

  it("cada filtro de servidor se reenvía al cambiar", () => {
    const { result, onServerFiltersChange } = setup();

    act(() => result.current.updateServerFilter("billingType", "MONTHLY"));
    expect(ultimoEnvio(onServerFiltersChange)).toMatchObject({ billingType: "MONTHLY" });

    act(() => result.current.updateServerFilter("temporal", "past"));
    expect(ultimoEnvio(onServerFiltersChange)).toMatchObject({ temporal: "past" });

    act(() => result.current.updateServerFilter("payment", "overdue"));
    expect(ultimoEnvio(onServerFiltersChange)).toMatchObject({ payment: "overdue" });

    act(() => result.current.updateServerFilter("status", "PENDING"));
    expect(ultimoEnvio(onServerFiltersChange)).toMatchObject({ status: "PENDING" });
  });

  it("la búsqueda viaja al servidor, con debounce", async () => {
    // Regresión: filtraba en cliente sobre las ≤10 filas cargadas, así que
    // buscar desde la página 1 no encontraba a nadie de la página 2.
    vi.useFakeTimers();
    try {
      const { result, onServerFiltersChange } = setup();

      act(() => result.current.handleSearchChange("ana"));
      expect(result.current.searchQuery).toBe("ana");
      expect(ultimoEnvio(onServerFiltersChange).search).toBe("");

      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(ultimoEnvio(onServerFiltersChange).search).toBe("ana");
    } finally {
      vi.useRealTimers();
    }
  });

  it("hasActiveFilters distingue los defaults de un filtro puesto", () => {
    const { result } = setup();

    // "all" es el default de temporal y de payment: no cuenta como filtro.
    act(() => result.current.updateServerFilter("temporal", "all"));
    act(() => result.current.updateServerFilter("payment", "all"));
    expect(result.current.hasActiveFilters).toBe(false);

    act(() => result.current.updateServerFilter("payment", "unpaid"));
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("limpiar devuelve todo a su default, no a cadena vacía", () => {
    // `temporal` y `payment` usan "all" como default; dejarlos en "" mandaría
    // un valor que el servidor no reconoce.
    const { result, onServerFiltersChange } = setup();

    act(() => result.current.updateServerFilter("temporal", "active"));
    act(() => result.current.updateServerFilter("payment", "overdue"));
    act(() => result.current.updateServerFilter("propertyId", "p1"));
    act(() => result.current.clearAllFilters());

    expect(result.current.hasActiveFilters).toBe(false);
    expect(ultimoEnvio(onServerFiltersChange)).toMatchObject({
      propertyId: "",
      billingType: "",
      status: "",
      temporal: "all",
      payment: "all",
    });
  });
});
