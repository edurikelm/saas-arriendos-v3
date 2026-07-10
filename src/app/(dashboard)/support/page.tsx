import { getSupportTickets, getSupportTicketsKpis } from "@/lib/actions/support";
import { SupportList } from "@/components/support/support-list";
import { requireOwner } from "@/lib/actions/auth";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function SupportPage({ searchParams }: PageProps) {
  await requireOwner();

  const { status } = await searchParams;
  const [result, kpis] = await Promise.all([
    getSupportTickets({ page: 1, limit: 10, status }),
    getSupportTicketsKpis(),
  ]);

  if (Array.isArray(result)) {
    return (
      <SupportList
        initialData={{ data: [], total: 0, page: 1, totalPages: 0 }}
        kpis={kpis}
      />
    );
  }

  return <SupportList initialData={result} currentStatus={status} kpis={kpis} />;
}
