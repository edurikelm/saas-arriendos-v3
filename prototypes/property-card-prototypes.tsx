"use client";

import { useState } from "react";
import Image from "next/image";
import { MapPin, Calendar, Users, Wifi, Car, Snowflake, Waves, Dumbbell, Coffee, MoreHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Property {
  id: string;
  name: string;
  type: string;
  unitsAvailable: number;
  dailyPrice: string;
  monthlyPrice: string | null;
  mainImage: string | null;
  color: string;
  amenities?: string[];
  location?: string;
}

const typeLabels: Record<string, string> = {
  HOUSE: "Casa",
  APARTMENT: "Departamento",
  CABIN: "Cabaña",
  HOSTEL: "Hostel",
  HOTEL: "Hotel",
  OFFICE: "Oficina",
  COMMERCIAL: "Comercial",
};

const amenityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  wifi: Wifi,
  parking: Car,
  pool: Waves,
  gym: Dumbbell,
  breakfast: Coffee,
  ac: Snowflake,
};

function formatPrice(price: string): string {
  return new Intl.NumberFormat("CLP", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

interface PropertyCardBaseProps {
  property: Property;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function PropertyCardMinimal({ property, onEdit, onDelete }: PropertyCardBaseProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 transition-all duration-500 hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1">
      <div className="relative h-48 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {property.mainImage ? (
          <Image
            src={property.mainImage}
            alt={property.name}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
            <span className="text-4xl font-light text-zinc-400">{property.name[0]}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute bottom-4 left-4 right-4 flex translate-y-full opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex gap-2">
            {onEdit && (
              <Button size="sm" variant="outline" className="bg-white/90 backdrop-blur-sm dark:bg-zinc-900/90" onClick={onEdit}>
                Editar
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="destructive" className="bg-white/90 backdrop-blur-sm dark:bg-zinc-900/90" onClick={onDelete}>
                Eliminar
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{property.name}</h3>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">{typeLabels[property.type] || property.type}</span>
          </div>
          <Badge variant="outline" className="shrink-0">
            {property.unitsAvailable} {property.unitsAvailable === 1 ? "unidad" : "unidades"}
          </Badge>
        </div>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatPrice(property.dailyPrice)}
          </span>
          <span className="text-sm text-zinc-500">/ noche</span>
        </div>

        {property.monthlyPrice && (
          <p className="mt-1 text-sm text-zinc-500">
            {formatPrice(property.monthlyPrice)} / mes
          </p>
        )}
      </div>

      <div
        className="absolute right-4 top-4 h-3 w-3 rounded-full opacity-60"
        style={{ backgroundColor: property.color }}
      />
    </div>
  );
}

export function PropertyCardImageHeavy({ property, onEdit, onDelete }: PropertyCardBaseProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group relative h-96 overflow-hidden rounded-3xl transition-all duration-500 hover:shadow-3xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="absolute inset-0">
        {property.mainImage ? (
          <Image
            src={property.mainImage}
            alt={property.name}
            fill
            className="object-cover transition-transform duration-1000 ease-out"
            style={{ transform: isHovered ? "scale(1.08)" : "scale(1)" }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600">
            <span className="text-8xl font-light text-white/50">{property.name[0]}</span>
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      <div className="absolute left-0 right-0 bottom-0 p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-white/70">{typeLabels[property.type] || property.type}</p>
            <h3 className="text-2xl font-bold text-white">{property.name}</h3>
          </div>
          <div
            className="h-12 w-12 rounded-xl border-2 border-white/30 backdrop-blur-md"
            style={{ backgroundColor: property.color + "40" }}
          />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-3xl font-bold text-white">{formatPrice(property.dailyPrice)}</p>
            <p className="text-sm text-white/60">por noche</p>
          </div>

          <div className="flex gap-3 opacity-0 translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
            {onEdit && (
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md border-white/30 text-white hover:bg-white/30"
                onClick={onEdit}
              >
                ✎
              </Button>
            )}
            {onDelete && (
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md border-white/30 text-white hover:bg-red-500/50 hover:border-red-500"
                onClick={onDelete}
              >
                ✕
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Users className="h-4 w-4" />
            <span>{property.unitsAvailable} unidades</span>
          </div>
          {property.monthlyPrice && (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Calendar className="h-4 w-4" />
              <span>{formatPrice(property.monthlyPrice)}/mes</span>
            </div>
          )}
        </div>
      </div>

      <div
        className="absolute right-4 top-4 h-10 w-10 rounded-full backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundColor: property.color + "80" }}
      >
        {property.name[0]}
      </div>
    </div>
  );
}

export function PropertyCardCompact({ property, onEdit, onDelete }: PropertyCardBaseProps) {
  return (
    <div className="group flex gap-4 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 bg-white dark:bg-zinc-950 p-3 transition-all duration-200 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg hover:shadow-black/5">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
        {property.mainImage ? (
          <Image
            src={property.mainImage}
            alt={property.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
            <span className="text-2xl font-light text-zinc-400">{property.name[0]}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between py-1">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">{property.name}</h3>
            <div
              className="h-3 w-3 rounded-full shrink-0 mt-1.5"
              style={{ backgroundColor: property.color }}
            />
          </div>
          <p className="text-sm text-zinc-500">{typeLabels[property.type] || property.type}</p>
        </div>

        <div className="flex items-end justify-between">
          <div className="space-y-0.5">
            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {formatPrice(property.dailyPrice)}
              <span className="text-xs font-normal text-zinc-500">/noche</span>
            </p>
            {property.monthlyPrice && (
              <p className="text-xs text-zinc-500">{formatPrice(property.monthlyPrice)}/mes</p>
            )}
          </div>

          <div className="flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <Badge variant="secondary" className="text-xs">
              {property.unitsAvailable}u
            </Badge>
            {onEdit && (
              <Button size="icon-xs" variant="ghost" onClick={onEdit}>
                ✎
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PropertyCardEditorial({ property, onEdit, onDelete }: PropertyCardBaseProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-stone-50 dark:bg-stone-900 border border-stone-200/50 dark:border-stone-800/50 transition-all duration-500 hover:shadow-2xl">
      <div className="grid grid-cols-5 gap-0">
        <div className="col-span-3 relative h-64 overflow-hidden">
          {property.mainImage ? (
            <Image
              src={property.mainImage}
              alt={property.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-300 dark:from-stone-800 dark:to-stone-900">
              <span className="text-8xl font-light text-stone-400">{property.name[0]}</span>
            </div>
          )}

          <div
            className="absolute left-4 top-4 h-8 w-8 rounded-full border-2 border-white/50"
            style={{ backgroundColor: property.color }}
          />
        </div>

        <div className="col-span-2 flex flex-col justify-between p-6">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-500">
              {typeLabels[property.type] || property.type}
            </p>
            <h3 className="font-serif text-2xl font-medium text-stone-900 dark:text-stone-100">
              {property.name}
            </h3>

            <div className="space-y-2 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Unidades disponibles</span>
                <span className="font-medium text-stone-900 dark:text-stone-100">
                  {property.unitsAvailable}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Precio por noche</span>
                <span className="font-medium text-stone-900 dark:text-stone-100">
                  {formatPrice(property.dailyPrice)}
                </span>
              </div>
              {property.monthlyPrice && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Precio mensual</span>
                  <span className="font-medium text-stone-900 dark:text-stone-100">
                    {formatPrice(property.monthlyPrice)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-stone-200 dark:border-stone-800 pt-4 mt-4">
            {property.amenities && property.amenities.length > 0 && (
              <div className="flex gap-2">
                {property.amenities.slice(0, 3).map((amenity) => {
                  const Icon = amenityIcons[amenity.toLowerCase()] || Amenities;
                  return (
                    <div
                      key={amenity}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"
                    >
                      <Icon className="h-4 w-4 text-stone-600 dark:text-stone-400" />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              {onEdit && (
                <Button size="sm" variant="outline" onClick={onEdit}>
                  Editar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Amenities({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

export function PropertyCardShowcase() {
  const mockProperties: Property[] = [
    {
      id: "1",
      name: "Casa del Lago",
      type: "HOUSE",
      unitsAvailable: 2,
      dailyPrice: "85000",
      monthlyPrice: "1800000",
      mainImage: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80",
      color: "#3B82F6",
      location: "Puerto Varas",
      amenities: ["wifi", "parking", "pool"],
    },
    {
      id: "2",
      name: "Departamento Centro",
      type: "APARTMENT",
      unitsAvailable: 1,
      dailyPrice: "45000",
      monthlyPrice: "750000",
      mainImage: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
      color: "#10B981",
      location: "Santiago",
      amenities: ["wifi", "ac"],
    },
    {
      id: "3",
      name: "Cabaña Andes",
      type: "CABIN",
      unitsAvailable: 3,
      dailyPrice: "120000",
      monthlyPrice: null,
      mainImage: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&q=80",
      color: "#F59E0B",
      location: "Bariloche",
      amenities: ["wifi", "parking", "breakfast"],
    },
    {
      id: "4",
      name: "Loft Industrial",
      type: "APARTMENT",
      unitsAvailable: 1,
      dailyPrice: "95000",
      monthlyPrice: "1600000",
      mainImage: "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&q=80",
      color: "#6366F1",
      location: "Valparaíso",
      amenities: ["wifi", "gym"],
    },
  ];

  return (
    <div className="space-y-12 p-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Property Card Prototypes</h2>
        <p className="text-muted-foreground">Distintas variantes de cards para propiedades</p>
      </div>

      <section>
        <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Minimal</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockProperties.slice(0, 3).map((property) => (
            <PropertyCardMinimal
              key={property.id}
              property={property}
              onEdit={() => console.log("Edit", property.id)}
              onDelete={() => console.log("Delete", property.id)}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Image Heavy (Hover para ver acciones)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mockProperties.slice(0, 2).map((property) => (
            <PropertyCardImageHeavy
              key={property.id}
              property={property}
              onEdit={() => console.log("Edit", property.id)}
              onDelete={() => console.log("Delete", property.id)}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Compact</h3>
        <div className="space-y-3">
          {mockProperties.map((property) => (
            <PropertyCardCompact
              key={property.id}
              property={property}
              onEdit={() => console.log("Edit", property.id)}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Editorial</h3>
        <div className="space-y-4">
          {mockProperties.slice(0, 2).map((property) => (
            <PropertyCardEditorial
              key={property.id}
              property={property}
              onEdit={() => console.log("Edit", property.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}