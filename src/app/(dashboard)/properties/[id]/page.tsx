import { requireOwner } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import { ExportFeedsSection } from "./_components/ExportFeedsSection";
import { ImportCalendarsSection } from "./_components/ImportCalendarsSection";

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params;
  const session = await requireOwner();

  const property = await prisma.property.findFirst({
    where: { id, userId: session.userId },
  });

  if (!property) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{property.name}</h1>
        <p className="text-muted-foreground mt-1">
          ID: {property.id}
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <ExportFeedsSection propertyId={property.id} />
      </div>

      <ImportCalendarsSection propertyId={property.id} />
    </div>
  );
}
