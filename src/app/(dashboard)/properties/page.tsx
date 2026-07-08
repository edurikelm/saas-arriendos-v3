import { getProperties } from "@/lib/actions/properties";
import { PropertiesClient } from "@/components/properties/properties-client";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const properties = await getProperties();

  return <PropertiesClient initialProperties={properties} />;
}