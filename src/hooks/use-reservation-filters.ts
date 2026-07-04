"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { getReservationPaidAmount } from "@/lib/payments/calculations";
import type { Reservation } from "@/components/reservations/types";

export interface ReservationFilters {
  propertyId: string;
  billingType: string;
  status: string;
  payment: string;
}

export interface UseReservationFiltersOptions {
  serverReservations: Reservation[];
  onServerFiltersChange: (filters: Pick<ReservationFilters, "propertyId" | "billingType" | "status">) => void;
}

export function useReservationFilters({
  serverReservations,
  onServerFiltersChange,
}: UseReservationFiltersOptions) {
  // Server-side filters (propertyId, billingType, status → trigger re-fetch)
  const [serverFilters, setServerFilters] = useState<Pick<ReservationFilters, "propertyId" | "billingType" | "status">>({
    propertyId: "",
    billingType: "",
    status: "",
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

  // Sync server filters to server
  useEffect(() => {
    onServerFiltersChange(serverFilters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverFilters]);

  const updateServerFilter = useCallback(<K extends keyof Pick<ReservationFilters, "propertyId" | "billingType" | "status">>(
    key: K,
    value: ReservationFilters[K]
  ) => {
    setServerFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setServerFilters({ propertyId: "", billingType: "", status: "" });
    setPaymentFilter("");
    setSearchQuery("");
    setDebouncedSearch("");
  }, []);

  const hasActiveFilters = useMemo(() =>
    serverFilters.propertyId !== "" ||
    serverFilters.billingType !== "" ||
    serverFilters.status !== "" ||
    paymentFilter !== "" ||
    debouncedSearch !== "",
  [serverFilters, paymentFilter, debouncedSearch]);

  // Apply local filters (payment + search) to server reservations
  const filteredReservations = useMemo(() => {
    let result = serverReservations;

    // Payment filter
    if (paymentFilter) {
      result = result.filter((res) => {
        const paidAmount = getReservationPaidAmount(res.payments);
        const totalPrice = Number(res.totalPrice);
        if (paymentFilter === "paid" && paidAmount < totalPrice) return false;
        if (paymentFilter === "pending" && paidAmount > 0) return false;
        if (paymentFilter === "overpaid" && paidAmount <= totalPrice) return false;
        return true;
      });
    }

    // Search filter (debounced)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((res) =>
        res.client?.name?.toLowerCase().includes(q) ||
        res.client?.email?.toLowerCase().includes(q) ||
        res.property?.name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [serverReservations, paymentFilter, debouncedSearch]);

  return {
    serverFilters,
    paymentFilter,
    searchQuery,
    debouncedSearch,
    filteredReservations,
    hasActiveFilters,
    updateServerFilter,
    updatePaymentFilter: setPaymentFilter,
    handleSearchChange,
    clearAllFilters,
  };
}
