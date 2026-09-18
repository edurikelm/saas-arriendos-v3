import { getBrokers, getBrokersKpis } from "@/lib/actions/brokers";
import { BrokersTable } from "@/components/brokers/brokers-table";

export const dynamic = "force-dynamic";

export default async function BrokersPage() {
  const [result, kpis] = await Promise.all([
    getBrokers({ page: 1, limit: 10 }),
    getBrokersKpis(),
  ]);

  const initialData = Array.isArray(result)
    ? { data: [], total: 0, page: 1, totalPages: 0 }
    : result;

  return <BrokersTable initialData={initialData} kpis={kpis} />;
}
