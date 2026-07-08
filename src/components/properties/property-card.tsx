"use client";

import Image from "next/image";
import { Pencil, Trash2, MapPin, DoorOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Property {
  id: string;
  name: string;
  type: string;
  unitsAvailable: number;
  dailyPrice: string;
  monthlyPrice: string | null;
  mainImage: string | null;
  color: string;
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

function formatPrice(price: string): string {
  return new Intl.NumberFormat("es-CL", {
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

export function PropertyCardGrid({ property, onEdit, onDelete }: PropertyCardBaseProps) {
  return (
    <Card className="group/property p-0 gap-0 ring-foreground/10 transition-colors hover:ring-primary/50 focus-within:ring-primary/50">
      <div className="relative h-48 w-full overflow-hidden">
        {property.mainImage ? (
          <Image
            src={property.mainImage}
            alt={property.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            loading="eager"
            className="object-cover transition-transform duration-500 group-hover/property:scale-105 group-focus-within/property:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted">
            <div
              className="flex size-16 items-center justify-center rounded-full transition-transform duration-500 group-hover/property:scale-105 group-focus-within/property:scale-105"
              style={{ backgroundColor: property.color + "20" }}
            >
              <span
                className="text-2xl font-semibold"
                style={{ color: property.color }}
              >
                {property.name[0]}
              </span>
            </div>
          </div>
        )}

        <Badge
          variant="default"
          className="absolute top-3 right-3 rounded-full text-[10px] font-bold uppercase shadow-sm"
        >
          Activa
        </Badge>

        <div
          className={cn(
            "absolute bottom-3 right-3 flex gap-1.5 transition-all duration-200",
            "opacity-0 group-hover/property:opacity-100 group-focus-within/property:opacity-100",
            "translate-y-1 group-hover/property:translate-y-0 group-focus-within/property:translate-y-0"
          )}
        >
          <Button
            variant="secondary"
            className="size-10 rounded-full p-0 shadow-md"
            onClick={onEdit}
            aria-label="Editar propiedad"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="secondary"
            className="size-10 rounded-full p-0 shadow-md"
            onClick={onDelete}
            aria-label="Eliminar propiedad"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      <Link
        href={`/properties/${property.id}`}
        className="block px-4 pt-4 pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-md"
      >
        <h3 className="text-sm font-semibold text-foreground line-clamp-1">
          {property.name}
        </h3>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 min-w-0">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{typeLabels[property.type] || property.type}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <DoorOpen className="size-3 shrink-0" />
            {property.unitsAvailable} {property.unitsAvailable === 1 ? "unidad" : "unidades"}
          </span>
        </div>
      </Link>

      <div className="grid grid-cols-3 border-t border-border">
        <div className="flex flex-col gap-1 px-3 py-3">
          <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">
            Unidades
          </span>
          <span className="text-xs font-bold text-foreground tabular-nums">
            {property.unitsAvailable}
          </span>
        </div>
        <div className="flex flex-col gap-1 border-l border-border px-3 py-3">
          <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">
            Precio Noche
          </span>
          <span
            suppressHydrationWarning
            className="text-xs font-bold text-foreground tabular-nums"
          >
            {formatPrice(property.dailyPrice)}
          </span>
        </div>
        <div className="flex flex-col gap-1 border-l border-border px-3 py-3">
          <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">
            Precio Mes
          </span>
          {property.monthlyPrice ? (
            <span
              suppressHydrationWarning
              className="text-xs font-bold text-foreground tabular-nums"
            >
              {formatPrice(property.monthlyPrice)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/60">—</span>
          )}
        </div>
      </div>
    </Card>
  );
}
