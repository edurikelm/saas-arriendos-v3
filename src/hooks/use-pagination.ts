import { useState, useEffect, useCallback } from "react";

interface UsePaginationOptions {
  total: number;
  totalPages: number;
  defaultPage?: number;
  defaultLimit?: number;
}

interface UsePaginationReturn {
  page: number;
  limit: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  setLimit: (limit: number) => void;
  range: { start: number; end: number };
}

export function usePagination(options: UsePaginationOptions): UsePaginationReturn {
  const { total, totalPages, defaultPage = 1, defaultLimit = 10 } = options;
  const [page, setPage] = useState(defaultPage);
  const [limit, setLimitState] = useState(defaultLimit);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset page when total decreases
      setPage(1);
    }
  }, [totalPages, page]);

  const range = {
    start: (page - 1) * limit + 1,
    end: Math.min(page * limit, total),
  };

  const goToPage = useCallback((p: number) => {
    if (p >= 1 && p <= totalPages) {
      setPage(p);
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (page < totalPages) {
      setPage((p) => p + 1);
    }
  }, [page, totalPages]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage((p) => p - 1);
    }
  }, [page]);

  const setLimit = useCallback((newLimit: number) => {
    setLimitState(newLimit);
    setPage(1);
  }, []);

  return { page, limit, goToPage, nextPage, prevPage, setLimit, range };
}
