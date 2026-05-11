"use client";

import { useState } from "react";
import { Calendar, User, Home, CreditCard, Clock, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";

interface Property {
  id: string;
  name: string;
  unitsAvailable: number;
  dailyPrice: string;
  monthlyPrice: string | null;
}

interface Client {
  id: string;
  name: string;
  email: string;
}

interface MockData {
  properties: Property[];
  clients: Client[];
}

const mockData: MockData = {
  properties: [
    { id: "1", name: "Casa del Lago", unitsAvailable: 3, dailyPrice: "85000", monthlyPrice: "1800000" },
    { id: "2", name: "Departamento Centro", unitsAvailable: 5, dailyPrice: "55000", monthlyPrice: "950000" },
    { id: "3", name: "Cabaña Andes", unitsAvailable: 2, dailyPrice: "120000", monthlyPrice: "2400000" },
    { id: "4", name: "Loft Patio", unitsAvailable: 1, dailyPrice: "65000", monthlyPrice: "1100000" },
  ],
  clients: [
    { id: "1", name: "María García", email: "maria.garcia@gmail.com" },
    { id: "2", name: "Carlos Rodríguez", email: "carlos.r@outlook.com" },
    { id: "3", name: "Ana Martínez", email: "ana.martinez@gmail.com" },
    { id: "4", name: "Pedro Sánchez", email: "pedro.s@gmail.com" },
  ],
};

export function ReservationFormDesignSystem({
  properties = mockData.properties,
  clients = mockData.clients,
}: {
  properties?: Property[];
  clients?: Client[];
}) {
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [billingType, setBillingType] = useState<"DAILY" | "MONTHLY">("DAILY");
  const [unitsBooked, setUnitsBooked] = useState(1);
  const [bookingAirbnb, setBookingAirbnb] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const property = properties.find((p) => p.id === selectedProperty);
  const client = clients.find((c) => c.id === selectedClient);

  const calculateTotal = () => {
    if (!property || !dateRange.from || !dateRange.to) return null;
    const nights = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const price = billingType === "DAILY" ? Number(property.dailyPrice) : Number(property.monthlyPrice);
    return nights * price * unitsBooked;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => setIsSubmitting(false), 1000);
  };

  return (
    <div className="max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Propiedad *</Label>
          <Select value={selectedProperty} onValueChange={(v) => v && setSelectedProperty(v)}>
            <SelectTrigger className="h-8 rounded-lg border border-input bg-background">
              <SelectValue placeholder="Seleccionar propiedad">
                {selectedProperty ? `${property?.name} (${property?.unitsAvailable} disp.)` : "Seleccionar propiedad"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    {p.name}
                    <Badge variant="secondary" className="ml-2 h-5 text-xs">{p.unitsAvailable} disp.</Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Cliente *</Label>
          <Select value={selectedClient} onValueChange={(v) => v && setSelectedClient(v)}>
            <SelectTrigger className="h-8 rounded-lg border border-input bg-background">
              <SelectValue placeholder="Seleccionar cliente">
                {selectedClient ? `${client?.name} (${client?.email})` : "Seleccionar cliente"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{c.name}</span>
                    <span className="text-muted-foreground text-sm">({c.email})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Fechas de Estadía *</Label>
          <DateRangePicker
            date={dateRange}
            onDateChange={setDateRange}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Tipo de Facturación *</Label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setBillingType("DAILY")}
              className={`flex-1 h-14 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-0.5 ${
                billingType === "DAILY"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background"
              }`}
            >
              <span className="text-xs font-medium text-foreground">Diario</span>
              <span className={`text-sm font-bold ${billingType === "DAILY" ? "text-primary" : "text-foreground"}`}>
                ${property ? Number(property.dailyPrice).toLocaleString("CLP") : "—"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setBillingType("MONTHLY")}
              className={`flex-1 h-14 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-0.5 ${
                billingType === "MONTHLY"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input bg-background"
              }`}
            >
              <span className="text-xs font-medium text-foreground">Mensual</span>
              <span className={`text-sm font-bold ${billingType === "MONTHLY" ? "text-primary" : "text-foreground"}`}>
                ${property ? Number(property.monthlyPrice).toLocaleString("CLP") : "—"}
              </span>
            </button>
          </div>
        </div>

        {property && dateRange.from && dateRange.to && (
          <div className="rounded-lg bg-muted p-4 space-y-1 shadow-sm">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total reserva</span>
              <span className="font-medium">
                {Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1} noches × {unitsBooked} unidad(es)
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">Monto total</span>
              <span className="text-2xl font-bold text-primary">
                ${calculateTotal()?.toLocaleString("CLP")}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="unitsBooked">Unidades Reservadas *</Label>
          <Input
            id="unitsBooked"
            type="number"
            min={1}
            max={property?.unitsAvailable || 1}
            value={unitsBooked}
            onChange={(e) => setUnitsBooked(Number(e.target.value))}
            className="h-8 rounded-lg border border-input bg-background"
          />
          {property && (
            <p className="text-xs text-muted-foreground">
              Disponibles: {property.unitsAvailable}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="bookingAirbnb"
            checked={bookingAirbnb}
            onCheckedChange={setBookingAirbnb}
          />
          <Label htmlFor="bookingAirbnb" className="text-sm font-medium cursor-pointer">Reserva de Airbnb</Label>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium" htmlFor="notes">Notas</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas para esta reserva (ej: necesita sofá cama)..."
            className="min-h-16 rounded-lg border border-input bg-background px-2.5 py-2 resize-none"
          />
        </div>

        <div className="flex justify-end gap-4 pt-2">
          <Button type="button" variant="outline" className="h-8 rounded-lg">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="h-8 rounded-lg">
            {isSubmitting ? "Guardando..." : "Guardar Reserva"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ReservationFormDesignSystemV2({
  properties = mockData.properties,
  clients = mockData.clients,
}: {
  properties?: Property[];
  clients?: Client[];
}) {
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [billingType, setBillingType] = useState<"DAILY" | "MONTHLY">("DAILY");
  const [unitsBooked, setUnitsBooked] = useState(1);
  const [bookingAirbnb, setBookingAirbnb] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const property = properties.find((p) => p.id === selectedProperty);
  const client = clients.find((c) => c.id === selectedClient);

  const calculateTotal = () => {
    if (!property || !dateRange.from || !dateRange.to) return null;
    const nights = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const price = billingType === "DAILY" ? Number(property.dailyPrice) : Number(property.monthlyPrice);
    return nights * price * unitsBooked;
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-card rounded-xl border border-border shadow-lg p-6">
        <div className="mb-6">
          <h2 className="text-lg font-medium leading-snug">Nueva Reserva</h2>
          <p className="text-sm text-muted-foreground">Complete los detalles para crear una nueva reserva</p>
        </div>

        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-card-foreground">Propiedad</Label>
              <Select value={selectedProperty} onValueChange={(v) => v && setSelectedProperty(v)}>
                <SelectTrigger className="h-8 rounded-lg border border-input bg-background">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-card-foreground">Cliente</Label>
              <Select value={selectedClient} onValueChange={(v) => v && setSelectedClient(v)}>
                <SelectTrigger className="h-8 rounded-lg border border-input bg-background">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {client && selectedClient && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm text-card-foreground">{client.name}</p>
                <p className="text-xs text-muted-foreground">{client.email}</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-card-foreground">Período de Estadía</Label>
            <DateRangePicker
              date={dateRange}
              onDateChange={setDateRange}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-card-foreground">Tipo de Tarifa</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["DAILY", "MONTHLY"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setBillingType(type)}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    billingType === type
                      ? "border-primary bg-primary/10"
                      : "border-input bg-background hover:border-ring/50"
                  }`}
                >
                  {billingType === type && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-2">
                    {type === "DAILY" ? (
                      <Clock className={`h-5 w-5 ${billingType === type ? "text-primary" : "text-muted-foreground"}`} />
                    ) : (
                      <Calendar className={`h-5 w-5 ${billingType === type ? "text-primary" : "text-muted-foreground"}`} />
                    )}
                    <span className={`text-sm font-medium ${billingType === type ? "text-primary" : "text-foreground"}`}>
                      {type === "DAILY" ? "Tarifa Diaria" : "Tarifa Mensual"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {property && (
            <div className="flex justify-between items-center p-4 rounded-lg bg-primary/5 border border-primary/20 shadow-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Precio por {billingType === "DAILY" ? "día" : "mes"}
                </p>
                <p className="text-2xl font-bold text-primary">
                  ${billingType === "DAILY" ? Number(property.dailyPrice).toLocaleString("CLP") : Number(property.monthlyPrice).toLocaleString("CLP")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-card-foreground">{property.unitsAvailable}</p>
                <p className="text-xs text-muted-foreground">unidades disponibles</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-card-foreground" htmlFor="unitsBooked">Unidades</Label>
              <Input
                id="unitsBooked"
                type="number"
                min={1}
                max={property?.unitsAvailable || 1}
                value={unitsBooked}
                onChange={(e) => setUnitsBooked(Number(e.target.value))}
                className="h-8 rounded-lg border border-input bg-background text-center"
              />
            </div>

            <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <Switch
                id="bookingAirbnb"
                checked={bookingAirbnb}
                onCheckedChange={setBookingAirbnb}
              />
              <Label htmlFor="bookingAirbnb" className="text-sm font-medium cursor-pointer">Airbnb</Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-card-foreground" htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Indicaciones especiales para la estadía..."
              className="min-h-16 rounded-lg border border-input bg-background px-2.5 py-2 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" className="flex-1 h-8 rounded-lg">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 h-8 rounded-lg">
              {isSubmitting ? "Guardando..." : "Crear Reserva"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ReservationFormDesignSystemShowcase() {
  return (
    <div className="space-y-16 p-8 bg-background min-h-screen">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Reservation Form Prototypes</h1>
        <p className="text-muted-foreground mt-2">Variantes usandi CSS tokens del design system</p>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-4 text-muted-foreground">Design System v1 - Simple</h2>
        <div className="bg-card rounded-xl border border-border shadow-lg p-6">
          <ReservationFormDesignSystem />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-4 text-muted-foreground">Design System v2 - Enhanced</h2>
        <div className="bg-muted/30 p-6 rounded-xl">
          <ReservationFormDesignSystemV2 />
        </div>
      </section>
    </div>
  );
}
