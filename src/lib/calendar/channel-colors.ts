import type { CalendarExternalBlock } from "@/lib/actions/reservations";

export type Channel = CalendarExternalBlock["channel"];

export interface ChannelColors {
  dotClass: string;
  labelClass: string;
}

/**
 * Semantic token mapping for external calendar channels.
 * AIRBNB → info (teal) | BOOKING_COM → primary (teal) | VRBO → accent (mint) | OTHER → muted
 *
 * Consumed by calendar-timeline.tsx for consistent channel markers.
 * Decision via grill-with-docs (PRD ID-6, slice S3).
 */
export const channelColors: Record<Channel, ChannelColors> = {
  AIRBNB: {
    dotClass: "bg-info",
    labelClass: "text-info",
  },
  BOOKING_COM: {
    dotClass: "bg-primary",
    labelClass: "text-primary",
  },
  VRBO: {
    dotClass: "bg-accent",
    labelClass: "text-accent",
  },
  OTHER: {
    dotClass: "bg-muted-foreground",
    labelClass: "text-muted-foreground",
  },
};
