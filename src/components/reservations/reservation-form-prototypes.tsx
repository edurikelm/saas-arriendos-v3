"use client";

import { useState } from "react";
import { Calendar, User, Home, CreditCard, Clock, Star, ChevronDown, AlertCircle, Check } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
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

export function ReservationFormMinimal({
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const property = properties.find((p) => p.id === selectedProperty);
  const client = clients.find((c) => c.id === selectedClient);

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Propiedad</Label>
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="w-full h-11 rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <SelectValue placeholder="Seleccionar propiedad">
                {selectedProperty ? `${property?.name} (${property?.unitsAvailable} disp.)` : "Seleccionar propiedad"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.unitsAvailable} disp.)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Cliente</Label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-full h-11 rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <SelectValue placeholder="Seleccionar cliente">
                {selectedClient ? `${client?.name} (${client?.email})` : "Seleccionar cliente"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Fechas</Label>
          <DateRangePicker
            date={dateRange}
            onDateChange={setDateRange}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tipo</Label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setBillingType("DAILY")}
              className={`flex-1 h-11 rounded-xl border-2 transition-all ${
                billingType === "DAILY"
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              Diario
            </button>
            <button
              type="button"
              onClick={() => setBillingType("MONTHLY")}
              className={`flex-1 h-11 rounded-xl border-2 transition-all ${
                billingType === "MONTHLY"
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              Mensual
            </button>
          </div>
        </div>

        {property && (
          <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900 p-4 space-y-1">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Precios disponibles</p>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Diario</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">${Number(property.dailyPrice).toLocaleString("CLP")}</span>
            </div>
            {property.monthlyPrice && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Mensual</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">${Number(property.monthlyPrice).toLocaleString("CLP")}</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Unidades</Label>
          <Input
            type="number"
            min={1}
            max={property?.unitsAvailable || 1}
            value={unitsBooked}
            onChange={(e) => setUnitsBooked(Number(e.target.value))}
            className="h-11 rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
          />
          {property && (
            <p className="text-xs text-zinc-500">{property.unitsAvailable} unidades disponibles</p>
          )}
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900">
          <Switch id="airbnb" />
          <Label htmlFor="airbnb" className="text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
            Reserva de Airbnb
          </Label>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Notas</Label>
          <Textarea
            placeholder="Notas para esta reserva..."
            className="min-h-[80px] rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 h-12 rounded-xl">
            Cancelar
          </Button>
          <Button className="flex-1 h-12 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900">
            {isSubmitting ? "Guardando..." : "Crear Reserva"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReservationFormEditorial({
  properties = mockData.properties,
  clients = mockData.clients,
}: {
  properties?: Property[];
  clients?: Client[];
}) {
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [billingType, setBillingType] = useState<"DAILY" | "MONTHLY">("DAILY");

  const property = properties.find((p) => p.id === selectedProperty);
  const client = clients.find((c) => c.id === selectedClient);

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h2 className="font-serif text-3xl text-stone-900 dark:text-stone-100 mb-2">Nueva Reserva</h2>
        <p className="text-stone-500">Complete los detalles para crear una nueva reserva</p>
      </div>

      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-widest text-stone-500">Propiedad</Label>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="h-12 rounded-lg border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-widest text-stone-500">Cliente</Label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="h-12 rounded-lg border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900">
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

        {client && (
          <div className="p-4 rounded-lg bg-stone-100 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center">
                <User className="h-5 w-5 text-stone-500" />
              </div>
              <div>
                <p className="font-medium text-stone-900 dark:text-stone-100">{client.name}</p>
                <p className="text-sm text-stone-500">{client.email}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-widest text-stone-500">Período</Label>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <Input type="date" className="h-12 rounded-lg border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900" />
            <span className="text-stone-400">→</span>
            <Input type="date" className="h-12 rounded-lg border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900" />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-medium uppercase tracking-widest text-stone-500">Tipo de Tarifa</Label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setBillingType("DAILY")}
              className={`p-4 rounded-lg border-2 transition-all ${
                billingType === "DAILY"
                  ? "border-stone-900 dark:border-stone-100 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
                  : "border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300"
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <Clock className="h-5 w-5" />
                <span className="font-medium">Tarifa Diaria</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setBillingType("MONTHLY")}
              className={`p-4 rounded-lg border-2 transition-all ${
                billingType === "MONTHLY"
                  ? "border-stone-900 dark:border-stone-100 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
                  : "border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300"
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">Tarifa Mensual</span>
              </div>
            </button>
          </div>
        </div>

        {property && (
          <div className="p-6 rounded-lg bg-gradient-to-br from-stone-100 to-stone-50 dark:from-stone-800 dark:to-stone-900 border border-stone-200 dark:border-stone-800">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-stone-500 mb-1">Precio por {billingType === "DAILY" ? "día" : "mes"}</p>
                <p className="text-3xl font-serif font-medium text-stone-900 dark:text-stone-100">
                  ${billingType === "DAILY" ? Number(property.dailyPrice).toLocaleString("CLP") : Number(property.monthlyPrice).toLocaleString("CLP")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-stone-500">{property.unitsAvailable} unidades</p>
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300">disponibles</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-widest text-stone-500">Unidades Reservadas</Label>
          <Input
            type="number"
            min={1}
            max={property?.unitsAvailable || 1}
            defaultValue={1}
            className="h-12 rounded-lg border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 text-center text-lg"
          />
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg border border-stone-200 dark:border-stone-800">
          <Switch id="airbnb" />
          <div className="flex-1">
            <Label htmlFor="airbnb" className="font-medium text-stone-900 dark:text-stone-100 cursor-pointer">
              Reserva de Airbnb
            </Label>
            <p className="text-sm text-stone-500">Marcar si esta reserva proviene de Airbnb</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-widest text-stone-500">Notas</Label>
          <Textarea
            placeholder="Indicaciones especiales para la estadía..."
            className="min-h-[100px] rounded-lg border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 resize-none"
          />
        </div>

        <div className="flex gap-4 pt-4 border-t border-stone-200 dark:border-stone-800">
          <Button variant="outline" className="flex-1 h-14 rounded-lg border-stone-200 dark:border-stone-800">
            Cancelar
          </Button>
          <Button className="flex-1 h-14 rounded-lg bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-stone-200 text-white dark:text-stone-900 font-medium">
            Confirmar Reserva
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ReservationFormModern({
  properties = mockData.properties,
  clients = mockData.clients,
}: {
  properties?: Property[];
  clients?: Client[];
}) {
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [billingType, setBillingType] = useState<"DAILY" | "MONTHLY">("DAILY");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const property = properties.find((p) => p.id === selectedProperty);

  return (
    <div className="max-w-xl mx-auto">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 p-[2px]">
        <div className="bg-white dark:bg-zinc-950 rounded-3xl p-8">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-sm font-medium mb-4">
              <Star className="h-4 w-4" />
              Nueva Reserva
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Crear Reservación
            </h2>
            <p className="text-zinc-500 mt-1">Ingrese los detalles de la nueva reserva</p>
          </div>

          <div className="space-y-6">
            <div className="group relative">
              <Label className="absolute -top-2 left-3 px-2 py-0.5 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-500 group-focus-within:text-purple-600 transition-colors">
                Propiedad
              </Label>
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger className="h-14 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 group-focus-within:border-purple-500 transition-colors">
                  <SelectValue placeholder="Seleccionar propiedad" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-zinc-400" />
                        {p.name}
                        <Badge variant="secondary" className="ml-2">{p.unitsAvailable} disp.</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="group relative">
              <Label className="absolute -top-2 left-3 px-2 py-0.5 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-500 group-focus-within:text-purple-600 transition-colors">
                Cliente
              </Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="h-14 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 group-focus-within:border-purple-500 transition-colors">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-zinc-400" />
                        {c.name}
                        <span className="text-zinc-400 text-sm ml-1">{c.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="group relative">
                <Label className="absolute -top-2 left-3 px-2 py-0.5 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-500">
                  Check-in
                </Label>
                <Input
                  type="date"
                  className="h-14 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
              <div className="group relative">
                <Label className="absolute -top-2 left-3 px-2 py-0.5 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-500">
                  Check-out
                </Label>
                <Input
                  type="date"
                  className="h-14 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tipo de Facturación</Label>
              <div className="grid grid-cols-2 gap-3">
                {(["DAILY", "MONTHLY"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setBillingType(type)}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      billingType === type
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-950"
                        : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                    }`}
                  >
                    {billingType === type && (
                      <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-purple-500 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-2">
                      {type === "DAILY" ? (
                        <Clock className={`h-5 w-5 ${billingType === type ? "text-purple-600" : "text-zinc-400"}`} />
                      ) : (
                        <Calendar className={`h-5 w-5 ${billingType === type ? "text-purple-600" : "text-zinc-400"}`} />
                      )}
                      <span className={`font-medium ${billingType === type ? "text-purple-700 dark:text-purple-300" : "text-zinc-600"}`}>
                        {type === "DAILY" ? "Diario" : "Mensual"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {property && (
              <div className="rounded-2xl bg-gradient-to-r from-purple-500 to-fuchsia-500 p-5 text-white">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-purple-100 text-sm mb-1">Precio {billingType === "DAILY" ? "diario" : "mensual"}</p>
                    <p className="text-3xl font-bold">
                      ${billingType === "DAILY" ? Number(property.dailyPrice).toLocaleString("CLP") : Number(property.monthlyPrice).toLocaleString("CLP")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{property.unitsAvailable}</p>
                    <p className="text-purple-100 text-sm">unidades disp.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="group relative">
              <Label className="absolute -top-2 left-3 px-2 py-0.5 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-500">
                Unidades Reservadas
              </Label>
              <Input
                type="number"
                min={1}
                max={property?.unitsAvailable || 1}
                defaultValue={1}
                className="h-14 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-center text-xl font-bold"
              />
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <Switch id="airbnb" />
              <div className="flex-1">
                <Label htmlFor="airbnb" className="font-medium text-zinc-900 dark:text-zinc-100 cursor-pointer">
                  Reserva de Airbnb
                </Label>
                <p className="text-sm text-zinc-500">Reserva proviene de la plataforma Airbnb</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                <span className="text-lg">🏠</span>
              </div>
            </div>

            <div className="group relative">
              <Label className="absolute -top-2 left-3 px-2 py-0.5 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-500">
                Notas
              </Label>
              <Textarea
                placeholder="Notas o indicaciones especiales..."
                className="min-h-[100px] rounded-xl border-2 border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 resize-none"
              />
            </div>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1 h-14 rounded-xl border-2">
                Cancelar
              </Button>
              <Button
                className="flex-1 h-14 rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600 text-white font-medium shadow-lg shadow-purple-500/25"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Guardando..." : "Crear Reserva"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReservationFormCompact({
  properties = mockData.properties,
  clients = mockData.clients,
}: {
  properties?: Property[];
  clients?: Client[];
}) {
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-12 w-12 rounded-xl bg-teal-500 flex items-center justify-center">
          <Calendar className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Nueva Reserva</h2>
          <p className="text-sm text-zinc-500">Complete la información rápidamente</p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs font-medium text-zinc-500 uppercase">Propiedad</Label>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue placeholder="Propiedad" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium text-zinc-500 uppercase">Unidades</Label>
            <Input type="number" min={1} defaultValue={1} className="h-10 rounded-lg" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-zinc-500 uppercase">Cliente</Label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name} ({c.email})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs font-medium text-zinc-500 uppercase">Desde</Label>
            <Input type="date" className="h-10 rounded-lg" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs font-medium text-zinc-500 uppercase">Hasta</Label>
            <Input type="date" className="h-10 rounded-lg" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs font-medium text-zinc-500 uppercase">Tarifa</Label>
            <Select defaultValue="DAILY">
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Diaria</SelectItem>
                <SelectItem value="MONTHLY">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-5">
            <Switch id="airbnb" />
            <Label htmlFor="airbnb" className="text-sm cursor-pointer">Airbnb</Label>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-zinc-500 uppercase">Notas</Label>
          <Textarea placeholder="Notas..." className="min-h-[60px] rounded-lg resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" size="sm" className="flex-1 rounded-lg">
            Cancelar
          </Button>
          <Button size="sm" className="flex-1 rounded-lg bg-teal-500 hover:bg-teal-600">
            Crear
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ReservationFormShowcase() {
  return (
    <div className="space-y-16 p-8 bg-zinc-100 dark:bg-zinc-900 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Reservation Form Prototypes</h1>
        <p className="text-zinc-500">Distintas variantes de formularios para crear reservas</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Minimal</h2>
        <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 shadow-xl">
          <ReservationFormMinimal />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Editorial</h2>
        <div className="bg-stone-50 dark:bg-stone-900 rounded-2xl p-6 shadow-xl">
          <ReservationFormEditorial />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Modern Gradient</h2>
        <div className="bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-6">
          <ReservationFormModern />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Compact</h2>
        <div className="bg-white dark:bg-zinc-950 rounded-2xl p-6 shadow-xl">
          <ReservationFormCompact />
        </div>
      </section>
    </div>
  );
}
