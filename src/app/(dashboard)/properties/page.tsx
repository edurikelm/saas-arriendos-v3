import { getProperties, getUsedColors } from "@/lib/actions/properties";
import { PropertiesClient } from "@/components/properties/properties-client";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const [properties, usedColors] = await Promise.all([
    getProperties(),
    getUsedColors(),
  ]);

  return (
    <PropertiesClient
      initialProperties={properties}
      usedColors={usedColors}
    />
  );
}