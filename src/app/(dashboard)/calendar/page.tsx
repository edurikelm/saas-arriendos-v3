"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale/es";
import { Calendar, Filter, Grid, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { CalendarTimeline } from "@/prototypes/calendar-prototypes";
import type { CalendarReservation } from "@/lib/actions/calendar";

function getNights(startDate: string, endDate: string): number {
  const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

interface Property {
  id: string;
  name: string;
  color?: string;
}

interface ReservationDetails {
  id: string;
  property: Property;
  client: { name: string; email: string };
  startDate: string;
  endDate: string;
  billingType: string;
  unitsBooked: number;
  totalPrice: string;
  status: string;
  bookingAirbnb: boolean;
  notes: string | null;
  payments: Array<{ id: string; amount: string; status: string; method: string }>;
}

export default function CalendarPage() {
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [selectedReservation, setSelectedReservation] = useState<ReservationDetails | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [currentMonth, selectedPropertyId]);

  const fetchProperties = async () => {
    try {
      const res = await fetch("/api/properties");
      if (res.ok) {
        const data = await res.json();
        setProperties(data);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  const fetchReservations = async () => {
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
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Calendario</h1>
            <p className="text-sm text-muted-foreground">
              Reservas del {format(currentMonth, "MMMM yyyy", { locale: es })}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reservas</CardTitle>
              <CardDescription>
                Visualiza las reservas diarias en el calendario
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex border rounded-md">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 ${viewMode === "grid" ? "bg-muted" : ""}`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : viewMode === "grid" ? (
            <CalendarGrid
              reservations={reservations}
              onSelectReservation={handleSelectReservation}
            />
          ) : (
            <CalendarTimeline
              reservations={reservations.map((r) => ({
                ...r,
                propertyId: r.property.id,
                clientId: "",
                billingType: "DAILY" as const,
                unitsBooked: 1,
                bookingAirbnb: false,
                notes: null,
                payments: [],
                startDate: r.startDate instanceof Date ? r.startDate.toISOString() : r.startDate,
                endDate: r.endDate instanceof Date ? r.endDate.toISOString() : r.endDate,
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
            />
          )}
        </CardContent>
      </Card>

      {selectedReservation && (
        <Dialog open onOpenChange={(open) => !open && setSelectedReservation(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalle de Reserva</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Propiedad</p>
                <p className="font-medium">{selectedReservation.property.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{selectedReservation.client.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entrada</p>
                <p className="font-medium">
                  {format(new Date(selectedReservation.startDate), "dd/MM/yyyy")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Última Noche</p>
                <p className="font-medium">
                  {format(new Date(selectedReservation.endDate), "dd/MM/yyyy")}
                  <span className="text-muted-foreground ml-1">
                    ({getNights(selectedReservation.startDate, selectedReservation.endDate)} noches)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <p className="font-medium">{selectedReservation.status}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="font-medium">
                  {Number(selectedReservation.totalPrice).toLocaleString("CLP")}
                </p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setSelectedReservation(null)}>
                Cerrar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}