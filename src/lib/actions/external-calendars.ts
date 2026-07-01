"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { ZodError } from "zod";
import {
  createExternalCalendarInputSchema,
  updateExternalCalendarInputSchema,
  syncExternalCalendarInputSchema,
  type CreateExternalCalendarInput,
  type UpdateExternalCalendarInput,
} from "@/lib/validations/external-calendar";
import { syncExternalCalendarPipeline } from "@/lib/ical/sync";
import { revalidatePath } from "next/cache";

export async function listExternalCalendars(
  propertyId: string,
  options?: { includeInactive?: boolean }
) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  // Validate property ownership
  const property = await prisma.property.findFirst({
    where: { id: propertyId, userId: session.userId },
    select: { id: true },
  });

  if (!property) {
    return { error: "Propiedad no encontrada" };
  }

  const where: Record<string, unknown> = {
    propertyId,
    ...(options?.includeInactive ? {} : { isActive: true }),
  };

  const calendars = await prisma.externalCalendar.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return calendars;
}

export async function createExternalCalendar(input: CreateExternalCalendarInput) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };
  if (session.plan !== "PRO") return { error: "Funcionalidad disponible solo para plan PRO" };

  let validated: CreateExternalCalendarInput;
  try {
    validated = createExternalCalendarInputSchema.parse(input);
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: "Datos inválidos", details: e.errors };
    }
    return { error: "Datos inválidos" };
  }

  // Validate property ownership
  const property = await prisma.property.findFirst({
    where: { id: validated.propertyId, userId: session.userId },
    select: { id: true },
  });

  if (!property) {
    return { error: "Propiedad no encontrada" };
  }

  const calendar = await prisma.externalCalendar.create({
    data: {
      userId: session.userId,
      propertyId: validated.propertyId,
      channel: validated.channel,
      name: validated.name,
      feedUrl: validated.feedUrl,
    },
  });

  revalidatePath(`/properties/${validated.propertyId}`);

  return { success: true, calendar };
}

export async function updateExternalCalendar(input: UpdateExternalCalendarInput) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };
  if (session.plan !== "PRO") return { error: "Funcionalidad disponible solo para plan PRO" };

  let validated: UpdateExternalCalendarInput;
  try {
    validated = updateExternalCalendarInputSchema.parse(input);
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: "Datos inválidos", details: e.errors };
    }
    return { error: "Datos inválidos" };
  }

  // Validate ownership
  const existing = await prisma.externalCalendar.findFirst({
    where: { id: validated.id, userId: session.userId },
  });

  if (!existing) {
    return { error: "Calendario no encontrado" };
  }

  const calendar = await prisma.externalCalendar.update({
    where: { id: validated.id },
    data: {
      ...(validated.name !== undefined && { name: validated.name }),
      ...(validated.feedUrl !== undefined && { feedUrl: validated.feedUrl }),
      ...(validated.isActive !== undefined && { isActive: validated.isActive }),
    },
  });

  revalidatePath(`/properties/${existing.propertyId}`);

  return { success: true, calendar };
}

export async function deleteExternalCalendar(id: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };
  if (session.plan !== "PRO") return { error: "Funcionalidad disponible solo para plan PRO" };

  // Validate ownership
  const existing = await prisma.externalCalendar.findFirst({
    where: { id, userId: session.userId },
  });

  if (!existing) {
    return { error: "Calendario no encontrado" };
  }

  // Soft delete: set isActive = false
  await prisma.externalCalendar.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath(`/properties/${existing.propertyId}`);

  return { success: true };
}

export async function syncExternalCalendar(input: { id: string }) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };
  if (session.plan !== "PRO") return { error: "Funcionalidad disponible solo para plan PRO" };

  let validated: { id: string };
  try {
    validated = syncExternalCalendarInputSchema.parse(input);
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: "Datos inválidos", details: e.errors };
    }
    return { error: "Datos inválidos" };
  }

  // Validate ownership
  const existing = await prisma.externalCalendar.findFirst({
    where: { id: validated.id, userId: session.userId },
  });

  if (!existing) {
    return { error: "Calendario no encontrado" };
  }

  const result = await syncExternalCalendarPipeline(validated.id);

  revalidatePath(`/properties/${existing.propertyId}`);

  if (result.ok) {
    return { success: true, count: result.count };
  } else {
    return { error: result.error };
  }
}

export async function getExternalCalendarStatus(id: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const calendar = await prisma.externalCalendar.findFirst({
    where: { id, userId: session.userId },
  });

  if (!calendar) {
    return { error: "Calendario no encontrado" };
  }

  return {
    isActive: calendar.isActive,
    lastSyncedAt: calendar.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: calendar.lastSyncError,
    lastSyncCount: calendar.lastSyncCount,
  };
}
