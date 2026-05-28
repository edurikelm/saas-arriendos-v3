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
import { createReservation } from "@/lib/actions/reservations";

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
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: currentMonth.getFullYear().toString(),
        month: (currentMonth.getMonth() + 1).toString(),
      });

      if (selectedPropertyId !== "all") {
        params.append("propertyId", selectedPropertyId);
      }

      const res = await fetch(`/api/reservations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReservations(data);
      }
    } catch (error) {
      console.error("Error fetching reservations:", error);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, selectedPropertyId]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

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
    <>
      <Button variant="default" size="sm" onClick={() => setCreateDialogOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Nueva Reserva
      </Button>
      <div className="flex overflow-hidden rounded-md border">
        <button
          type="button"
          onClick={() => setViewMode("grid")}
          className={`p-2 ${viewMode === "grid" ? "bg-muted" : ""}`}
        >
          <Grid className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setViewMode("timeline")}
          className={`p-2 ${viewMode === "timeline" ? "bg-muted" : ""}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>
      <Filter className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedPropertyId} onValueChange={(v) => setSelectedPropertyId(v || "all")}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Todas las propiedades" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las propiedades</SelectItem>
          {properties.map((property) => (
            <SelectItem key={property.id} value={property.id}>
              {property.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <div className="space-y-6 lg:h-[calc(100vh-7rem)] lg:min-h-0">
      <Card className="lg:h-full lg:min-h-0 lg:gap-0 lg:py-3">
        <CardContent className="pt-3 lg:h-full lg:min-h-0 lg:pb-0">
          {loading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : viewMode === "grid" ? (
            <CalendarGrid
              reservations={dailyReservations}
              onSelectReservation={handleSelectReservation}
              headerActions={headerActions}
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
