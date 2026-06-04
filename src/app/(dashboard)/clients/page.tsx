import { getClients } from "@/lib/actions/clients";
import { ClientsTable } from "@/components/clients/clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const result = await getClients({ page: 1, limit: 10 });

  return <ClientsTable initialData={result as any} />;
}
