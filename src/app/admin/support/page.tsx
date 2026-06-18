import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AdminSupportList } from "@/components/admin/support/admin-support-list";
import { getAllSupportTickets, type StatusFilter } from "@/lib/actions/admin-support";

interface PageProps {
  searchParams: Promise<{ status?: string; ownerId?: string; priority?: string; category?: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminSupportPage({ searchParams }: PageProps) {
  const { status, ownerId, priority, category } = await searchParams;
  const filter = status as StatusFilter;
  const result = await getAllSupportTickets(filter, { ownerId, priority, category });

  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Cargando tickets...
          </CardContent>
        </Card>
      }
    >
      <AdminSupportList tickets={result.data} total={result.total} />
    </Suspense>
  );
}
