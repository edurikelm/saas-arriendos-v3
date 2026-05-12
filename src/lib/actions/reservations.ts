"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { reservationSchema, reservationUpdateSchema, type ReservationInput, type ReservationUpdateInput } from "@/lib/validations/reservation";
import { revalidatePath } from "next/cache";
import { addDays, addMonths, differenceInDays, differenceInMonths, startOfDay, endOfDay } from "date-fns";

export type CalendarReservation = {
  id: string;
  startDate: Date;
  endDate: Date;
  status: string;
  totalPrice: number;
  property: {
    id: string;
    name: string;
    color: string;
  };
  client: {
    name: string;
  };
};

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
        where: { deletedAt: null },
        select: {
          id: true,
          amount: true,
          status: true,
          method: true,
          initPoint: true,
          expiresAt: true,
        },
      },
    },
    orderBy: { startDate: "desc" },
  });

  return reservations.map((r) => ({
    ...r,
    totalPrice: String(r.totalPrice),
    property: {
      ...r.property,
      dailyPrice: String(r.property.dailyPrice),
      monthlyPrice: r.property.monthlyPrice ? String(r.property.monthlyPrice) : null,
    },
    payments: r.payments.map((p) => ({
      ...p,
      amount: String(p.amount),
      initPoint: p.initPoint ? String(p.initPoint) : null,
      expiresAt: p.expiresAt ? String(p.expiresAt) : null,
    })),
  }));
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

  if (!reservation) return null;

  return {
    ...reservation,
    totalPrice: String(reservation.totalPrice),
    property: {
      ...reservation.property,
      dailyPrice: String(reservation.property.dailyPrice),
      monthlyPrice: reservation.property.monthlyPrice ? String(reservation.property.monthlyPrice) : null,
    },
    payments: reservation.payments
      .filter((p) => !p.deletedAt)
      .map((p) => ({
        ...p,
        amount: String(p.amount),
        initPoint: p.initPoint ? String(p.initPoint) : null,
        expiresAt: p.expiresAt ? String(p.expiresAt) : null,
      })),
  };
}

function calculateTotalPrice(
  property: { dailyPrice: any; monthlyPrice: any | null },
  billingType: "DAILY" | "MONTHLY",
  startDate: Date,
  endDate: Date,
  unitsBooked: number,
  months?: number
): number {
  if (billingType === "MONTHLY") {
    const monthsCount = months || Math.max(1, differenceInMonths(endDate, startDate));
    return Number(property.monthlyPrice || 0) * monthsCount * unitsBooked;
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

export async function createReservation(data: unknown) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  let validated: ReservationInput;
  try {
    validated = reservationSchema.parse(data);
  } catch (e: any) {
    if (e.name === 'ZodError') {
      return { error: "Datos inválidos", details: e.errors };
    }
    return { error: "Datos inválidos" };
  }
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
    validated.unitsBooked,
    validated.months
  );

  const months = validated.billingType === "MONTHLY" ? (validated.months || 1) : 0;

  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.create({
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

    await tx.reservationChange.create({
      data: {
        reservationId: reservation.id,
        field: "created",
        oldValue: null,
        newValue: "Reservation created",
      },
    });

    if (validated.billingType === "MONTHLY" && months > 0) {
      const monthlyAmount = property.monthlyPrice || 0;
      const payments = [];

      for (let i = 1; i <= months; i++) {
        const monthStart = addMonths(startDate, i - 1);
        const lastDayOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);

        await tx.payment.create({
          data: {
            reservationId: reservation.id,
            amount: monthlyAmount,
            method: "CASH",
            status: "PENDING",
            expiresAt: lastDayOfMonth,
            monthNumber: i,
            totalMonths: months,
          },
        });
      }
    }

    return reservation;
  });

  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return { success: true, reservation: result };
}

export async function updateReservation(id: string, data: unknown) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  let validated: ReservationUpdateInput;
  try {
    validated = reservationUpdateSchema.parse(data);
  } catch (e: any) {
    if (e.name === 'ZodError') {
      return { error: "Datos inválidos", details: e.errors };
    }
    return { error: "Datos inválidos" };
  }

  const existing = await prisma.reservation.findFirst({
    where: { id, userId: session.userId },
    include: { property: true },
  });

  if (!existing) return { error: "Reserva no encontrada" };

  const updateData: any = {};
  const changes: { field: string; old: string; new: string }[] = [];

  if (validated.propertyId !== undefined && validated.propertyId !== existing.propertyId) {
    updateData.propertyId = validated.propertyId;
    changes.push({
      field: "propertyId",
      old: existing.propertyId,
      new: validated.propertyId,
    });
  }

  if (validated.clientId !== undefined && validated.clientId !== existing.clientId) {
    updateData.clientId = validated.clientId;
    changes.push({
      field: "clientId",
      old: existing.clientId,
      new: validated.clientId,
    });
  }

  if (validated.startDate !== undefined) {
    const startDate = new Date(validated.startDate);
    if (startDate.toString() === "Invalid Date") {
      return { error: "Fecha de inicio inválida" };
    }
    if (startDate.getTime() !== existing.startDate.getTime()) {
      updateData.startDate = startDate;
      changes.push({
        field: "startDate",
        old: existing.startDate.toISOString(),
        new: startDate.toISOString(),
      });
    }
  }

  if (validated.endDate !== undefined) {
    const endDate = new Date(validated.endDate);
    if (endDate.toString() === "Invalid Date") {
      return { error: "Fecha de fin inválida" };
    }
    if (endDate.getTime() !== existing.endDate.getTime()) {
      updateData.endDate = endDate;
      changes.push({
        field: "endDate",
        old: existing.endDate.toISOString(),
        new: endDate.toISOString(),
      });
    }
  }

  if (validated.billingType !== undefined && validated.billingType !== existing.billingType) {
    updateData.billingType = validated.billingType;
    changes.push({
      field: "billingType",
      old: existing.billingType,
      new: validated.billingType,
    });
  }

  if (validated.unitsBooked !== undefined && validated.unitsBooked !== existing.unitsBooked) {
    updateData.unitsBooked = validated.unitsBooked;
    changes.push({
      field: "unitsBooked",
      old: String(existing.unitsBooked),
      new: String(validated.unitsBooked),
    });
  }

  if (validated.bookingAirbnb !== undefined && validated.bookingAirbnb !== existing.bookingAirbnb) {
    updateData.bookingAirbnb = validated.bookingAirbnb;
    changes.push({
      field: "bookingAirbnb",
      old: String(existing.bookingAirbnb),
      new: String(validated.bookingAirbnb),
    });
  }

  if (validated.status !== undefined && validated.status !== existing.status) {
    updateData.status = validated.status as any;
    changes.push({
      field: "status",
      old: existing.status,
      new: validated.status,
    });
  }

  if (validated.notes !== undefined && validated.notes !== existing.notes) {
    updateData.notes = validated.notes;
    changes.push({
      field: "notes",
      old: existing.notes || "",
      new: validated.notes || "",
    });
  }

  if (changes.length > 0) {
    const propertyId = updateData.propertyId || existing.propertyId;
    const startDate = updateData.startDate || existing.startDate;
    const endDate = updateData.endDate || existing.endDate;
    const unitsBooked = updateData.unitsBooked || existing.unitsBooked;

    const availability = await checkAvailability(
      propertyId,
      startDate,
      endDate,
      unitsBooked,
      id
    );

    if (!availability.available) {
      return { error: availability.reason };
    }

    const propertyForPrice = updateData.propertyId
      ? await prisma.property.findUnique({ where: { id: updateData.propertyId } })
      : existing.property;

    if (!propertyForPrice) {
      return { error: "Propiedad no encontrada" };
    }

    updateData.totalPrice = calculateTotalPrice(
      propertyForPrice,
      (updateData.billingType || existing.billingType) as "DAILY" | "MONTHLY",
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

export async function getBlockedDates(propertyId: string) {
  const session = await getSession();
  if (!session) return [];

  const reservations = await prisma.reservation.findMany({
    where: {
      propertyId,
      userId: session.userId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: {
      startDate: true,
      endDate: true,
      unitsBooked: true,
    },
  });

  const blockedDates: Date[] = [];

  for (const res of reservations) {
    const start = new Date(res.startDate);
    const end = new Date(res.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      blockedDates.push(new Date(d));
    }
  }

  return blockedDates.map(d => d.toISOString());
}

export async function getCalendarReservations(options?: {
  year: number;
  month: number;
  propertyId?: string;
}) {
  const session = await getSession();
  if (!session) return [];

  const now = new Date();
  const year = options?.year || now.getFullYear();
  const month = options?.month || now.getMonth();

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  const where: any = {
    userId: session.userId,
    billingType: "DAILY",
    OR: [
      {
        startDate: { gte: startDate, lte: endDate },
      },
      {
        endDate: { gte: startDate, lte: endDate },
      },
      {
        AND: [
          { startDate: { lte: startDate } },
          { endDate: { gte: endDate } },
        ],
      },
    ],
  };

  if (options?.propertyId) {
    where.propertyId = options.propertyId;
  }

  const reservations = await prisma.reservation.findMany({
    where,
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      totalPrice: true,
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
    orderBy: { startDate: "asc" },
  });

  return reservations.map((r) => ({
    ...r,
    totalPrice: Number(r.totalPrice),
  }));
}

export async function getReservationsByDateRange(start: Date, end: Date) {
  const session = await getSession();
  if (!session) return [];

  const reservations = await prisma.reservation.findMany({
    where: {
      userId: session.userId,
      billingType: "DAILY",
      OR: [
        {
          startDate: { gte: start, lte: end },
        },
        {
          endDate: { gte: start, lte: end },
        },
        {
          AND: [
            { startDate: { lte: start } },
            { endDate: { gte: end } },
          ],
        },
      ],
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      totalPrice: true,
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
    orderBy: { startDate: "asc" },
  });

  return reservations.map((r) => ({
    ...r,
    totalPrice: Number(r.totalPrice),
  }));
}

export async function deleteReservation(id: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const existing = await prisma.reservation.findFirst({
    where: { id, userId: session.userId },
  });

  if (!existing) return { error: "Reserva no encontrada" };

  await prisma.reservationChange.deleteMany({
    where: { reservationId: id },
  });

  await prisma.payment.deleteMany({
    where: { reservationId: id },
  });

  await prisma.reservation.delete({
    where: { id },
  });

  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return { success: true };
}