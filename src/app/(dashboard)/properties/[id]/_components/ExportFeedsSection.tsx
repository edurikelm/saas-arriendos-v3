import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { listPropertyExportFeeds } from "@/lib/actions/property-export-feeds";
import { ExportFeedsClient } from "./ExportFeedsClient";

type FeedChannel = "AIRBNB" | "BOOKING_COM" | "VRBO" | "OTHER";

const CHANNELS: { value: FeedChannel; label: string }[] = [
  { value: "AIRBNB", label: "Airbnb" },
  { value: "BOOKING_COM", label: "Booking.com" },
  { value: "VRBO", label: "VRBO" },
  { value: "OTHER", label: "Otro" },
];

type Feed = {
  id: string;
  channel: FeedChannel;
  tokenLastFour: string;
  createdAt: Date;
  lastRotatedAt: Date;
  lastFetchedAt: Date | null;
  urlPreview: string;
};

interface ExportFeedsSectionProps {
  propertyId: string;
}

export async function ExportFeedsSection({ propertyId }: ExportFeedsSectionProps) {
  const session = await requireOwner();

  const property = await import("@/lib/db/prisma").then(({ prisma }) =>
    prisma.property.findFirst({
      where: { id: propertyId, userId: session.userId },
      select: { id: true },
    })
  );

  if (!property) {
    notFound();
  }

  const feedsResult = await listPropertyExportFeeds(propertyId);

  if ("error" in feedsResult) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{feedsResult.error}</p>
      </div>
    );
  }

  const feeds = feedsResult as Feed[];
  const isPro = session.plan === "PRO";

  return (
    <ExportFeedsClient
      propertyId={propertyId}
      channels={CHANNELS}
      feeds={feeds}
      isPro={isPro}
    />
  );
}
