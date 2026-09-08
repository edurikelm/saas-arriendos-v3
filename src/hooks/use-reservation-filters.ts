"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";

export interface ReservationFilters {
  propertyId: string;
  billingType: string;
  status: string;
  temporal: string;
  payment: string;
}

/** Los filtros que viajan al servidor y por lo tanto afectan la paginación. */
export type ServerReservationFilters = Pick<
  ReservationFilters,
  "propertyId" | "billingType" | "status" | "temporal" | "payment"
> & { search: string };

type ServerFilterKey = keyof Omit<ServerReservationFilters, "search">;

export interface UseReservationFiltersOptions {
  onServerFiltersChange: (filters: ServerReservationFilters) => void;
}

/**
 * Filtros de la lista de reservas. **Todos viajan al servidor**, así que todos
 * respetan la paginación.
 *
 * Antes la búsqueda y el filtro de pago se aplicaban en el cliente sobre las
 * ≤10 filas ya cargadas: filtrar "Pendiente" o buscar un nombre desde la
 * página 1 no veía nada de la página 2. Como ya no queda ningún filtro de
 * página, el contador de la lista puede mostrar siempre un rango real y
 * desapareció la variante "N de M en esta página".
 */
export function useReservationFilters({
  onServerFiltersChange,
}: UseReservationFiltersOptions) {
  // Server-side filters (propertyId, billingType, status → trigger re-fetch)
  const [serverFilters, setServerFilters] = useState<Omit<ServerReservationFilters, "search">>({
    propertyId: "",
    billingType: "",
    status: "",
    temporal: "all",
    payment: "all",
  });

  // Client search (debounced, local filter)
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }, []);

  // Sync server filters to server.
  //
  // `debouncedSearch` entra acá porque la búsqueda ahora se resuelve en el
  // servidor: antes filtraba solo las ≤10 filas de la página cargada, así que
  // buscar a alguien que estaba en la página 3 desde la página 1 no lo
  // encontraba — y `getReservations` ya soportaba `search` sin que nadie se lo
  // mandara.
  useEffect(() => {
    onServerFiltersChange({ ...serverFilters, search: debouncedSearch });
  }, [serverFilters, debouncedSearch, onServerFiltersChange]);

  const updateServerFilter = useCallback(<K extends ServerFilterKey>(
    key: K,
    value: ServerReservationFilters[K]
  ) => {
    setServerFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setServerFilters({ propertyId: "", billingType: "", status: "", temporal: "all", payment: "all" });
    setSearchQuery("");
    setDebouncedSearch("");
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      serverFilters.propertyId !== "" ||
      serverFilters.billingType !== "" ||
      serverFilters.status !== "" ||
      serverFilters.temporal !== "all" ||
      serverFilters.payment !== "all" ||
      debouncedSearch !== "",
    [serverFilters, debouncedSearch],
  );

  return {
    serverFilters,
    searchQuery,
    debouncedSearch,
    hasActiveFilters,
    updateServerFilter,
    handleSearchChange,
    clearAllFilters,
  };
}
