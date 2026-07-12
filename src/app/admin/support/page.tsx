import { Suspense } from "react";
import { LifeBuoy } from "lucide-react";
import { AdminSupportList } from "@/components/admin/support/admin-support-list";
import { getAllSupportTickets } from "@/lib/actions/admin-support";
import type { StatusFilter } from "@/lib/support/types";

interface PageProps {
  searchParams: Promise<{ status?: string; ownerId?: string; priority?: string; category?: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminSupportPage({ searchParams }: PageProps) {
  const { status, ownerId, priority, category } = await searchParams;
  const filter = status as StatusFilter;
  const result = await getAllSupportTickets(filter, { ownerId, priority, category });

  return (
    <div className="space-y-6">
      {/* Header (PageHeader pattern per admin/page.tsx) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <LifeBuoy className="size-5 text-muted-foreground" />
            Soporte
          </h1>
          <p className="text-xs text-muted-foreground">
            Bandeja de entrada de tickets de soporte ({result.total} tickets)
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="py-8 text-center text-sm text-muted-foreground">
            Cargando tickets...
          </div>
        }
      >
        <AdminSupportList tickets={result.data} total={result.total} />
      </Suspense>
    </div>
  );
}
