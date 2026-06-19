"use client";

import { useState, useEffect, useCallback } from "react";
import { Filter, Grid, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { CalendarTimeline } from "@/components/calendar/calendar-timeline";
import { ReservationDetailDialog } from "@/components/reservations/reservation-detail-dialog";
import { ReservationForm } from "@/components/reservations/reservation-form";
import type { CalendarReservation } from "@/lib/actions/reservations";
import type { ReservationInput } from "@/lib/validations/reservation";
import { createReservation, getCalendarReservations } from "@/lib/actions/reservations";

interface Property {
  id: string;
  name: string;
  color?: string;
  unitsAvailable: number;
  dailyPrice: string;
  monthlyPrice: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

interface ReservationDetails {
  id: string;
  propertyId: string;
  clientId: string;
  property: Property;
  client: Client;
  startDate: string;
  endDate: string;
  billingType: string;
  unitsBooked: number;
  totalPrice: string;
  status: string;
  bookingAirbnb: boolean;
  notes: string | null;
  payments: Array<{ id: string; amount: string; status: string; method: string; initPoint?: string | null; expiresAt?: string | null }>;
}

interface CalendarViewProps {
  initialReservations: CalendarReservation[];
  properties: Property[];
  clients: Client[];
  plan?: string;
}

export function CalendarView({ initialReservations, properties, clients, plan = "FREE" }: CalendarViewProps) {
  const [reservations, setReservations] = useState<CalendarReservation[]>(initialReservations);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<ReservationDetails | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("timeline");

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const data = await getCalendarReservations({
        year,
        month,
        propertyId: selectedPropertyId !== "all" ? selectedPropertyId : undefined,
      });
      setReservations(data);
    } catch (error) {
      console.error("Error fetching reservations:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId, currentMonth]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on dependency change
    fetchReservations();
  }, [selectedPropertyId, currentMonth, fetchReservations]);

  const handleSelectReservation = async (id: string) => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedReservation(data);
      }
    } catch (error) {
      console.error("Error fetching reservation:", error);
    }
  };

  const handleRefreshReservation = async (id: string) => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedReservation(data);
      }
    } catch (error) {
      console.error("Error refreshing reservation:", error);
    }
  };

  const handleCreateReservation = async (data: ReservationInput) => {
    const result = await createReservation(data);

    if (result && 'error' in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Reserva creada correctamente");
    setCreateDialogOpen(false);
    fetchReservations();
  };

  const dailyReservations = reservations.filter((r) => r.billingType === "DAILY");
  const headerActions = (
    <div className="grid w-full grid-cols-[auto_auto_1fr] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
      <Button variant="default" onClick={() => setCreateDialogOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        <span className="hidden sm:inline">Nueva Reserva</span>
        <span className="sm:hidden">Nueva</span>
      </Button>
      <div className="flex h-8 overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        <button
          type="button"
          aria-label="Ver calendario mensual"
          aria-pressed={viewMode === "grid"}
          onClick={() => setViewMode("grid")}
          className={`grid size-8 place-items-center transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
        >
          <Grid className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Ver timeline de ocupación"
          aria-pressed={viewMode === "timeline"}
          onClick={() => setViewMode("timeline")}
          className={`grid size-8 place-items-center border-l border-border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${viewMode === "timeline" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <Filter className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
        <Select value={selectedPropertyId} onValueChange={(v) => setSelectedPropertyId(v || "all")}>
          <SelectTrigger className="w-full min-w-0 sm:w-48">
            <SelectValue placeholder="Propiedades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className={`space-y-6 lg:min-h-0 ${viewMode === "grid" ? "lg:h-[calc(100vh-7rem)]" : ""}`}>
      <Card className={`lg:min-h-0 lg:gap-0 lg:py-3 ${viewMode === "grid" ? "lg:h-full" : ""}`}>
        <CardContent className={`pt-3 lg:min-h-0 lg:pb-0 ${viewMode === "grid" ? "lg:h-full" : ""}`}>
          {loading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : viewMode === "grid" ? (
            <CalendarGrid
              reservations={dailyReservations}
              onSelectReservation={handleSelectReservation}
              headerActions={headerActions}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
            />
          ) : (
            <CalendarTimeline
              reservations={dailyReservations.map((r) => ({
                ...r,
                propertyId: r.property.id,
                clientId: "",
                billingType: "DAILY" as const,
                unitsBooked: 1,
                bookingAirbnb: false,
                notes: null,
                payments: [],
                startDate: r.startDate,
                endDate: r.endDate,
                totalPrice: String(r.totalPrice),
                property: {
                  ...r.property,
                  color: properties.find((p) => p.id === r.property.id)?.color,
                },
                client: {
                  ...r.client,
                  id: "",
                  email: "",
                },
              }))}
              currentMonth={currentMonth}
              onSelectReservation={handleSelectReservation}
              onMonthChange={setCurrentMonth}
              headerActions={headerActions}
            />
          )}
        </CardContent>
      </Card>

      {selectedReservation && (
        <ReservationDetailDialog
          reservation={selectedReservation}
          open={!!selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onRefresh={handleRefreshReservation}
        />
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl gap-0 p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-4 pr-12">
            <DialogTitle>Nueva Reserva</DialogTitle>
            <DialogDescription>
              Completa los datos principales de la estadía y confirma la reserva.
            </DialogDescription>
          </DialogHeader>
          <ReservationForm
            properties={properties}
            clients={clients}
            plan={plan as "FREE" | "PRO"}
            onSubmit={handleCreateReservation}
            onCancel={() => setCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
