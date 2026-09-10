"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/ui/pagination";

interface PaginationWrapperProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

export function PaginationWrapper({ page, totalPages, total, limit }: PaginationWrapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Cambiar de página conserva los filtros activos. Antes esto navegaba a
  // `/payments?page=N` construido desde cero, así que pasar a la página 2
  // descartaba propiedad, método, estado, tipo y rango de fechas y devolvía al
  // listado completo. Mismo patrón que `updateUrl` en `payments-filters.tsx`:
  // partir de los params actuales y sobrescribir solo la clave que cambia.
  function handlePageChange(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    router.push(`/payments?${params.toString()}`);
  }

  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      total={total}
      limit={limit}
      onPageChange={handlePageChange}
    />
  );
}
