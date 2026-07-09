"use client";

import { useRouter } from "next/navigation";
import { Pagination } from "@/components/ui/pagination";

interface PaginationWrapperProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

export function PaginationWrapper({ page, totalPages, total, limit }: PaginationWrapperProps) {
  const router = useRouter();

  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      total={total}
      limit={limit}
      onPageChange={(p) => router.push(`/payments?page=${p}`)}
    />
  );
}
