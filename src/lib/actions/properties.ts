"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { propertySchema, type PropertyInput } from "@/lib/validations/property";
import { revalidatePath } from "next/cache";

const FREE_PROPERTY_LIMIT = 3;

export async function getProperties() {
  const session = await getSession();
  if (!session) return [];

  const properties = await prisma.property.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  return properties;
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

  return property;
}

export async function getPropertyCount() {
  const session = await getSession();
  if (!session) return 0;

  return prisma.property.count({
    where: { userId: session.userId },
  });
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

  const validated = propertySchema.parse(data);

  const property = await prisma.property.create({
    data: {
      userId: session.userId,
      name: validated.name,
      type: validated.type as any,
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

  const validated = propertySchema.parse(data);

  const property = await prisma.property.update({
    where: { id },
    data: {
      name: validated.name,
      type: validated.type as any,
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