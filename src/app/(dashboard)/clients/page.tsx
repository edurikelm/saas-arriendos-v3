import { getClients } from "@/lib/actions/clients";
import { ClientsTable } from "@/components/clients/clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const result = await getClients({ page: 1, limit: 10 });

  if (Array.isArray(result)) {
    return <ClientsTable initialData={{ data: [], total: 0, page: 1, totalPages: 0 }} />;
  }

  const initialData = {
    data: result.data.map((c) => ({ ...c, createdAt: new Date(c.createdAt) })),
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
  };
  return <ClientsTable initialData={initialData} />;
}
