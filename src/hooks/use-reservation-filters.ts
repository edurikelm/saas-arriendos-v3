"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { getReservationPaidAmount } from "@/lib/payments/calculations";
import type { Reservation } from "@/components/reservations/types";

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
  "propertyId" | "billingType" | "status" | "temporal"
> & { search: string };

export interface UseReservationFiltersOptions {
  serverReservations: Reservation[];
  onServerFiltersChange: (filters: ServerReservationFilters) => void;
}

export function useReservationFilters({
  serverReservations,
  onServerFiltersChange,
}: UseReservationFiltersOptions) {
  // Server-side filters (propertyId, billingType, status → trigger re-fetch)
  const [serverFilters, setServerFilters] = useState<
    Pick<ReservationFilters, "propertyId" | "billingType" | "status" | "temporal">
  >({
    propertyId: "",
    billingType: "",
    status: "",
    temporal: "all",
  });

  // Local filters (payment → client-side, no re-fetch)
  const [paymentFilter, setPaymentFilter] = useState("");

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

  const updateServerFilter = useCallback(<K extends keyof Pick<ReservationFilters, "propertyId" | "billingType" | "status" | "temporal">>(
    key: K,
    value: ReservationFilters[K]
  ) => {
    setServerFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setServerFilters({ propertyId: "", billingType: "", status: "", temporal: "all" });
    setPaymentFilter("");
    setSearchQuery("");
    setDebouncedSearch("");
  }, []);

  /**
   * Filtros que se aplican SOLO a la página actual (no vuelven al servidor).
   * El contador de la lista los necesita aparte: mientras estén activos, el
   * rango "X-Y de {total}" no describe nada, porque `total` es el total del
   * servidor sin filtrar y las filas visibles son un subconjunto de una página.
   *
   * Desde que la búsqueda se resuelve en el servidor, el único que queda acá es
   * el filtro de pago — que depende de los pagos ya cargados de cada fila.
   */
  const hasClientFilters = useMemo(() => paymentFilter !== "", [paymentFilter]);

  const hasActiveFilters = useMemo(() =>
    serverFilters.propertyId !== "" ||
    serverFilters.billingType !== "" ||
    serverFilters.status !== "" ||
    serverFilters.temporal !== "all" ||
    paymentFilter !== "" ||
    debouncedSearch !== "",
  [serverFilters, paymentFilter, debouncedSearch]);

  // Apply local filters (payment + search) to server reservations
  const filteredReservations = useMemo(() => {
    let result = serverReservations;

    // Payment filter
    //
    // "pending" significa "queda saldo por cobrar", no "no tiene ningún abono".
    // La versión anterior descartaba cualquier reserva con `paidAmount > 0`, así
    // que una con $200.000 abonados de $620.000 — que debe $420.000 y es
    // justamente a la que hay que perseguir — quedaba fuera del filtro con el
    // que uno busca a los que deben.
    //
    // Las canceladas quedan fuera: no tienen saldo por cobrar (misma regla que
    // `getFinanceTone` en reservation-finance.ts).
    if (paymentFilter) {
      result = result.filter((res) => {
        const paidAmount = getReservationPaidAmount(res.payments);
        const totalPrice = Number(res.totalPrice);
        if (paymentFilter === "paid") return totalPrice > 0 && paidAmount >= totalPrice;
        if (paymentFilter === "pending") return res.status !== "CANCELLED" && paidAmount < totalPrice;
        if (paymentFilter === "overpaid") return paidAmount > totalPrice;
        return true;
      });
    }

    // La búsqueda ya no se filtra acá: viaja al servidor con el resto de los
    // filtros que afectan la paginación.
    return result;
  }, [serverReservations, paymentFilter]);

  return {
    serverFilters,
    paymentFilter,
    searchQuery,
    debouncedSearch,
    filteredReservations,
    hasActiveFilters,
    hasClientFilters,
    updateServerFilter,
    updatePaymentFilter: setPaymentFilter,
    handleSearchChange,
    clearAllFilters,
  };
}
