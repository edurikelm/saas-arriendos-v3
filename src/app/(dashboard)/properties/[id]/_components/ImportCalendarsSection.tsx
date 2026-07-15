import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { listExternalCalendars } from "@/lib/actions/external-calendars";
import { ImportCalendarsClient } from "./ImportCalendarsClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportCalendarsSectionProps {
  propertyId: string;
}

export async function ImportCalendarsSection({ propertyId }: ImportCalendarsSectionProps) {
  const session = await requireOwner();
  const isPro = session.plan === "PRO";

  if (!isPro) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="size-5 text-muted-foreground" />
            <CardTitle>Calendarios externos importados</CardTitle>
          </div>
          <CardDescription>
            Conecta feeds iCal de Airbnb, Booking.com o VRBO para bloquear disponibilidad
            automáticamente desde tus canales externos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Esta funcionalidad está disponible en el plan PRO.
            </p>
            <Link
              href="/pricing"
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
            >
              Ver planes
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const result = await listExternalCalendars(propertyId);

  if ("error" in result) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="size-5 text-muted-foreground" />
            <CardTitle>Calendarios externos importados</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{result.error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Serialize dates to ISO strings for client component props.
  const calendars = result.map((c) => ({
    id: c.id,
    name: c.name,
    channel: c.channel,
    feedUrl: c.feedUrl,
    isActive: c.isActive,
    lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: c.lastSyncError,
    lastSyncCount: c.lastSyncCount,
    createdAt: c.createdAt.toISOString(),
  }));

  return <ImportCalendarsClient propertyId={propertyId} calendars={calendars} />;
}
