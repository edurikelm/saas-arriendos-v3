import { useState, useEffect } from "react";

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
    if (page > totalPages) {
      setPage(1);
    }
  }, [totalPages, page]);

  const range = {
    start: (page - 1) * limit + 1,
    end: Math.min(page * limit, total),
  };

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setPage(p);
    }
  };

  const nextPage = () => {
    if (page < totalPages) {
      setPage((p) => p + 1);
    }
  };

  const prevPage = () => {
    if (page > 1) {
      setPage((p) => p - 1);
    }
  };

  const setLimit = (newLimit: number) => {
    setLimitState(newLimit);
    setPage(1);
  };

  return { page, limit, goToPage, nextPage, prevPage, setLimit, range };
}
