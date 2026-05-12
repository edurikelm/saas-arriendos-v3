import { getClients } from "@/lib/actions/clients";
import { ClientsTable } from "@/components/clients/clients-table";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await getClients();

  return <ClientsTable initialClients={clients} />;
}
