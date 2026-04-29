"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { reservationSchema, reservationUpdateSchema, type ReservationInput, type ReservationUpdateInput } from "@/lib/validations/reservation";
import { revalidatePath } from "next/cache";
import { addDays, differenceInDays, differenceInMonths, startOfDay, endOfDay } from "date-fns";

export async function getReservations(filters?: {
  propertyId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  const session = await getSession();
  if (!session) return [];

  const where: any = { userId: session.userId };

  if (filters?.propertyId) {
    where.propertyId = filters.propertyId;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.startDate && filters?.endDate) {
    where.startDate = {
      gte: new Date(filters.startDate),
    };
    where.endDate = {
      lte: new Date(filters.endDate),
    };
  }

  const reservations = await prisma.reservation.findMany({
    where,
    include: {
      property: {
        select: {
          id: true,
          name: true,
          color: true,
          dailyPrice: true,
          monthlyPrice: true,
          unitsAvailable: true,
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      payments: {
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  return reservations;
}

export async function getReservationsForCalendar(startDate: string, endDate: string) {
  const session = await getSession();
  if (!session) return [];

  const reservations = await prisma.reservation.findMany({
    where: {
      userId: session.userId,
      billingType: "DAILY",
      status: { in: ["PENDING", "CONFIRMED"] },
      startDate: { lte: new Date(endDate) },
      endDate: { gte: new Date(startDate) },
    },
    include: {
      property: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      client: {
        select: {
          name: true,
        },
      },
    },
  });

  return reservations;
}

export async function getReservationById(id: string) {
  const session = await getSession();
  if (!session) return null;

  const reservation = await prisma.reservation.findFirst({
    where: {
      id,
      userId: session.userId,
    },
    include: {
      property: true,
      client: true,
      payments: true,
      changes: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return reservation;
}

function calculateTotalPrice(
  property: { dailyPrice: any; monthlyPrice: any | null },
  billingType: "DAILY" | "MONTHLY",
  startDate: Date,
  endDate: Date,
  unitsBooked: number
): number {
  if (billingType === "MONTHLY") {
    const months = Math.max(1, differenceInMonths(endDate, startDate));
    return Number(property.monthlyPrice || 0) * months * unitsBooked;
  }

  const nights = differenceInDays(endDate, startDate);
  return Number(property.dailyPrice) * nights * unitsBooked;
}

async function checkAvailability(
  propertyId: string,
  startDate: Date,
  endDate: Date,
  unitsBooked: number,
  excludeReservationId?: string
): Promise<{ available: boolean; reason?: string }> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (!property) {
    return { available: false, reason: "Propiedad no encontrada" };
  }

  const conflictingReservations = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: { in: ["PENDING", "CONFIRMED"] },
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      OR: [
        {
          startDate: { lte: startDate },
          endDate: { gte: startDate },
        },
        {
          startDate: { lte: endDate },
          endDate: { gte: endDate },
        },
        {
          startDate: { gte: startDate },
          endDate: { lte: endDate },
        },
      ],
    },
  });

  for (const day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
    let bookedUnits = 0;

    for (const reservation of conflictingReservations) {
      const resStart = new Date(reservation.startDate);
      const resEnd = new Date(reservation.endDate);

      if (day >= resStart && day <= resEnd) {
        bookedUnits += reservation.unitsBooked;
      }
    }

    if (bookedUnits + unitsBooked > property.unitsAvailable) {
      return {
        available: false,
        reason: `No hay disponibilidad para el ${day.toLocaleDateString("es-CL")}. Solo quedan ${property.unitsAvailable - bookedUnits} unidades.`,
      };
    }
  }

  return { available: true };
}

async function logChange(
  reservationId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null
) {
  await prisma.reservationChange.create({
    data: {
      reservationId,
      field,
      oldValue,
      newValue,
    },
  });
}

export async function createReservation(data: ReservationInput) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const validated = reservationSchema.parse(data);
  const startDate = new Date(validated.startDate);
  const endDate = new Date(validated.endDate);

  const property = await prisma.property.findUnique({
    where: { id: validated.propertyId },
  });

  if (!property) {
    return { error: "Propiedad no encontrada" };
  }

  const availability = await checkAvailability(
    validated.propertyId,
    startDate,
    endDate,
    validated.unitsBooked
  );

  if (!availability.available) {
    return { error: availability.reason };
  }

  const totalPrice = calculateTotalPrice(
    property,
    validated.billingType,
    startDate,
    endDate,
    validated.unitsBooked
  );

  const reservation = await prisma.reservation.create({
    data: {
      userId: session.userId,
      propertyId: validated.propertyId,
      clientId: validated.clientId,
      startDate,
      endDate,
      billingType: validated.billingType,
      unitsBooked: validated.unitsBooked,
      totalPrice,
      status: "PENDING",
      bookingAirbnb: validated.bookingAirbnb,
      notes: validated.notes ?? null,
    },
  });

  await logChange(reservation.id, "created", null, "Reservation created");

  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return { success: true, reservation };
}

export async function updateReservation(id: string, data: ReservationUpdateInput) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const existing = await prisma.reservation.findFirst({
    where: { id, userId: session.userId },
    include: { property: true },
  });

  if (!existing) return { error: "Reserva no encontrada" };

  const updateData: any = {};
  const changes: { field: string; old: string; new: string }[] = [];

  if (data.startDate !== undefined && data.startDate.getTime() !== existing.startDate.getTime()) {
    updateData.startDate = new Date(data.startDate);
    changes.push({
      field: "startDate",
      old: existing.startDate.toISOString(),
      new: updateData.startDate.toISOString(),
    });
  }

  if (data.endDate !== undefined && data.endDate.getTime() !== existing.endDate.getTime()) {
    updateData.endDate = new Date(data.endDate);
    changes.push({
      field: "endDate",
      old: existing.endDate.toISOString(),
      new: updateData.endDate.toISOString(),
    });
  }

  if (data.unitsBooked !== undefined && data.unitsBooked !== existing.unitsBooked) {
    updateData.unitsBooked = data.unitsBooked;
    changes.push({
      field: "unitsBooked",
      old: String(existing.unitsBooked),
      new: String(data.unitsBooked),
    });
  }

  if (data.status !== undefined && data.status !== existing.status) {
    updateData.status = data.status as any;
    changes.push({
      field: "status",
      old: existing.status,
      new: data.status,
    });
  }

  if (data.notes !== undefined && data.notes !== existing.notes) {
    updateData.notes = data.notes;
    changes.push({
      field: "notes",
      old: existing.notes || "",
      new: data.notes || "",
    });
  }

  if (changes.length > 0) {
    const startDate = updateData.startDate || existing.startDate;
    const endDate = updateData.endDate || existing.endDate;
    const unitsBooked = updateData.unitsBooked || existing.unitsBooked;

    const availability = await checkAvailability(
      existing.propertyId,
      startDate,
      endDate,
      unitsBooked,
      id
    );

    if (!availability.available) {
      return { error: availability.reason };
    }

    updateData.totalPrice = calculateTotalPrice(
      existing.property,
      existing.billingType as "DAILY" | "MONTHLY",
      startDate,
      endDate,
      unitsBooked
    );

    for (const change of changes) {
      await logChange(id, change.field, change.old, change.new);
    }
  }

  const reservation = await prisma.reservation.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return { success: true, reservation };
}

export async function cancelReservation(id: string, reason?: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const existing = await prisma.reservation.findFirst({
    where: { id, userId: session.userId },
  });

  if (!existing) return { error: "Reserva no encontrada" };

  await logChange(id, "status", existing.status, "CANCELLED");
  if (reason) {
    await logChange(id, "cancellation_reason", null, reason);
  }

  const reservation = await prisma.reservation.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return { success: true, reservation };
}