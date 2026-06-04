"use server";

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/actions/auth";
import { propertySchema, type PropertyInput } from "@/lib/validations/property";
import { revalidatePath } from "next/cache";

const FREE_PROPERTY_LIMIT = 3;

export async function getProperties(type?: string) {
  const session = await getSession();
  if (!session) return [];

  const where: Prisma.PropertyWhereInput = { userId: session.userId };
  if (type && type !== "all" && (type === "APARTMENT" || type === "HOUSE" || type === "CABIN" || type === "HOSTEL" || type === "HOTEL" || type === "OFFICE" || type === "COMMERCIAL")) {
    where.type = type;
  }

  const properties = await prisma.property.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return properties.map((p) => ({
    id: p.id,
    userId: p.userId,
    name: p.name,
    type: p.type,
    unitsAvailable: p.unitsAvailable,
    dailyPrice: String(p.dailyPrice),
    monthlyPrice: p.monthlyPrice ? String(p.monthlyPrice) : null,
    currency: p.currency,
    amenities: p.amenities,
    color: p.color,
    mainImage: p.mainImage,
    images: p.images,
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function getPropertyById(id: string) {
  const session = await getSession();
  if (!session) return null;

  const property = await prisma.property.findFirst({
    where: {
      id,
      userId: session.userId,
    },
  });

  if (!property) return null;

  return {
    id: property.id,
    userId: property.userId,
    name: property.name,
    type: property.type,
    unitsAvailable: property.unitsAvailable,
    dailyPrice: String(property.dailyPrice),
    monthlyPrice: property.monthlyPrice ? String(property.monthlyPrice) : null,
    currency: property.currency,
    amenities: property.amenities,
    color: property.color,
    mainImage: property.mainImage,
    images: property.images,
    createdAt: property.createdAt.toISOString(),
  };
}

export async function getPropertyCount() {
  const session = await getSession();
  if (!session) return 0;

  return prisma.property.count({
    where: { userId: session.userId },
  });
}

export async function getUsedColors() {
  const session = await getSession();
  if (!session) return [];

  const properties = await prisma.property.findMany({
    where: { userId: session.userId },
    select: { color: true },
  });

  return properties.map((p) => p.color);
}

const ALL_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

export async function getAvailableColors() {
  const usedColors = await getUsedColors();
  return ALL_COLORS.filter((color) => !usedColors.includes(color));
}

export async function createProperty(data: PropertyInput) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  // Check plan limits
  if (session.plan === "FREE") {
    const count = await prisma.property.count({
      where: { userId: session.userId },
    });

    if (count >= FREE_PROPERTY_LIMIT) {
      return {
        error: `Has alcanzado el límite de ${FREE_PROPERTY_LIMIT} propiedades de tu plan FREE. Haz upgrade a PRO para propiedades ilimitadas.`,
        upgrade: true,
      };
    }
  }

  // Check color uniqueness for this user
  const existingWithColor = await prisma.property.findFirst({
    where: {
      userId: session.userId,
      color: data.color,
    },
  });

  if (existingWithColor) {
    return {
      error: "Ese color ya está en uso por otra propiedad. Elige uno diferente.",
    };
  }

  const validated = propertySchema.parse(data);

  const property = await prisma.property.create({
    data: {
      userId: session.userId,
      name: validated.name,
      type: validated.type,
      unitsAvailable: validated.unitsAvailable,
      dailyPrice: validated.dailyPrice,
      monthlyPrice: validated.monthlyPrice ?? null,
      currency: validated.currency,
      amenities: validated.amenities,
      color: validated.color,
      mainImage: validated.mainImage ?? null,
      images: validated.images,
    },
  });

  revalidatePath("/properties");
  return { success: true, property };
}

export async function updateProperty(id: string, data: PropertyInput) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  // Verify ownership
  const existing = await prisma.property.findFirst({
    where: { id, userId: session.userId },
  });

  if (!existing) return { error: "Propiedad no encontrada" };

  // Check color uniqueness for this user (excluding current property)
  if (data.color !== existing.color) {
    const existingWithColor = await prisma.property.findFirst({
      where: {
        userId: session.userId,
        color: data.color,
        id: { not: id },
      },
    });

    if (existingWithColor) {
      return {
        error: "Ese color ya está en uso por otra propiedad. Elige uno diferente.",
      };
    }
  }

  const validated = propertySchema.parse(data);

  const property = await prisma.property.update({
    where: { id },
    data: {
      name: validated.name,
      type: validated.type,
      unitsAvailable: validated.unitsAvailable,
      dailyPrice: validated.dailyPrice,
      monthlyPrice: validated.monthlyPrice ?? null,
      currency: validated.currency,
      amenities: validated.amenities,
      color: validated.color,
      mainImage: validated.mainImage ?? null,
      images: validated.images,
    },
  });

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  return { success: true, property };
}

export async function deleteProperty(id: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  // Verify ownership
  const existing = await prisma.property.findFirst({
    where: { id, userId: session.userId },
  });

  if (!existing) return { error: "Propiedad no encontrada" };

  await prisma.property.delete({
    where: { id },
  });

  revalidatePath("/properties");
  return { success: true };
}