"use client";

import Image from "next/image";
import { Pencil, Trash2, MapPin, DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  APARTMENT: "Depto",
  CABIN: "Cabaña",
  HOSTEL: "Hostel",
  HOTEL: "Hotel",
  OFFICE: "Oficina",
  COMMERCIAL: "Comercial",
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

export function PropertyCardGrid({ property, onEdit, onDelete }: PropertyCardBaseProps) {
  return (
    <div className="group/card relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5 hover:border-foreground/20">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: property.color }}
      />

      <div className="relative aspect-[16/9] overflow-hidden">
        {property.mainImage ? (
          <Image
            src={property.mainImage}
            alt={property.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="eager"
            className="object-cover transition-transform duration-500 group-hover/card:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-linear-to-br from-muted/80 to-muted">
            <div
              className="flex size-16 items-center justify-center rounded-full transition-transform duration-500 group-hover/card:scale-105"
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

        <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/50 to-transparent" />

        <div className="absolute left-3 bottom-3 flex items-center gap-2">
          <div
            className="size-2.5 rounded-full ring-1 ring-white/30"
            style={{ backgroundColor: property.color }}
          />
          <Badge variant="secondary" className="bg-black/40 text-white border-0 text-[11px]">
            {typeLabels[property.type] || property.type}
          </Badge>
        </div>

        <div
          className={cn(
            "absolute right-2.5 top-2.5 flex gap-1 transition-all duration-200",
            "opacity-0 group-hover/card:opacity-100",
            "translate-y-1 group-hover/card:translate-y-0"
          )}
        >
          <Button size="icon-xs" variant="secondary" className="size-8 shadow-md" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button size="icon-xs" variant="secondary" className="size-8 shadow-md" onClick={onDelete}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">{property.name}</h3>
            <div className="mt-1 flex items-center gap-2.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {typeLabels[property.type] || property.type}
              </span>
              <span className="flex items-center gap-1">
                <DoorOpen className="size-3" />
                {property.unitsAvailable} {property.unitsAvailable === 1 ? "unidad" : "unidades"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1">
            <span suppressHydrationWarning className="text-base font-bold tabular-nums">
              {formatPrice(property.dailyPrice)}
            </span>
            <span className="text-[11px] text-muted-foreground">/noche</span>
          </div>
          {property.monthlyPrice ? (
            <span suppressHydrationWarning className="text-xs font-medium text-muted-foreground tabular-nums">
              {formatPrice(property.monthlyPrice)}<span className="text-[11px]">/mes</span>
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground/60">Sin precio mensual</span>
          )}
        </div>
      </div>
    </div>
  );
}
