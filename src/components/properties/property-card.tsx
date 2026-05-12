"use client";

import { useState } from "react";
import Image from "next/image";
import { MoreHorizontal, Pencil, Trash2, Plus, Users, Calendar } from "lucide-react";
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

export function PropertyCardLine({ property, onEdit, onDelete }: PropertyCardBaseProps) {
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-border bg-card p-3 transition-all duration-200 hover:shadow-md hover:shadow-foreground/5 hover:border-foreground/20">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {property.mainImage ? (
          <Image src={property.mainImage} alt={property.name} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-lg font-medium text-muted-foreground">{property.name[0]}</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{property.name}</h3>
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: property.color }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{typeLabels[property.type] || property.type}</p>
        </div>

        <div className="hidden sm:block w-20 text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{property.unitsAvailable}</span>
          </div>
        </div>

        <div className="w-28 text-right">
          <p suppressHydrationWarning className="font-semibold">{formatPrice(property.dailyPrice)}</p>
          <p className="text-xs text-muted-foreground">/noche</p>
        </div>

        {property.monthlyPrice && (
          <div className="hidden md:block w-28 text-right">
            <p suppressHydrationWarning className="font-medium">{formatPrice(property.monthlyPrice)}</p>
            <p className="text-xs text-muted-foreground">/mes</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <Button size="icon-xs" variant="ghost" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export function PropertyCardGrid({ property, onEdit, onDelete }: PropertyCardBaseProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:shadow-lg hover:shadow-foreground/5 hover:-translate-y-0.5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative aspect-4/3 overflow-hidden bg-muted">
        {property.mainImage ? (
          <Image
            src={property.mainImage}
            alt={property.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-muted to-muted/50">
            <span className="text-4xl font-medium text-muted-foreground/50">{property.name[0]}</span>
          </div>
        )}

        <div
          className="absolute left-3 top-3 h-7 w-7 rounded-md border border-white/20 shadow-sm"
          style={{ backgroundColor: property.color }}
        />

        <div
          className={cn(
            "absolute right-3 top-3 flex gap-1 transition-all duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <Button size="icon-xs" variant="secondary" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon-xs" variant="secondary" onClick={onDelete}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium truncate">{property.name}</h3>
            <p className="text-xs text-muted-foreground">{typeLabels[property.type] || property.type}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {property.unitsAvailable}u
          </Badge>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <span suppressHydrationWarning className="text-lg font-bold">{formatPrice(property.dailyPrice)}</span>
            <span className="text-xs text-muted-foreground ml-1">/noche</span>
          </div>
          {property.monthlyPrice && (
            <span suppressHydrationWarning className="text-xs text-muted-foreground">
              {formatPrice(property.monthlyPrice)}/mes
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PropertyCardStacked({ property, onEdit, onDelete }: PropertyCardBaseProps) {
  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-all duration-200 hover:shadow-md hover:shadow-foreground/5">
      <div className="relative h-28 overflow-hidden bg-muted">
        {property.mainImage ? (
          <Image src={property.mainImage} alt={property.name} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-r from-primary/20 to-primary/5">
            <span className="text-3xl font-medium text-primary/30">{property.name[0]}</span>
          </div>
        )}
        <div
          className="absolute bottom-2 left-2 h-6 w-6 rounded-full border-2 border-white/30 shadow-sm"
          style={{ backgroundColor: property.color }}
        />
      </div>

      <div className="flex flex-1 items-center justify-between p-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm truncate">{property.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{typeLabels[property.type]}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{property.unitsAvailable}u</span>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <Button size="icon-xs" variant="ghost" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="border-t bg-muted/30 px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span suppressHydrationWarning className="font-semibold text-sm">{formatPrice(property.dailyPrice)}</span>
          {property.monthlyPrice ? (
            <span suppressHydrationWarning className="text-xs text-muted-foreground">{formatPrice(property.monthlyPrice)}/mes</span>
          ) : (
            <span className="text-xs text-muted-foreground">Sin precio mensual</span>
          )}
        </div>
      </div>
    </div>
  );
}