"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { reservationSchema, reservationUpdateSchema, type ReservationInput, type ReservationUpdateInput } from "@/lib/validations/reservation";
import { revalidatePath } from "next/cache";
import { addDays, differenceInDays, differenceInMonths, startOfDay, endOfDay, addMonths } from "date-fns";
import { generateMonthlyPayments } from "@/lib/payments/monthly";

export type CalendarReservation = {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  billingType: string;
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

export async function getReservations(params?: {
  page?: number;
  limit?: number;
  search?: string;
  propertyId?: string;
  status?: string;
  billingType?: string;
  startDate?: string;
  endDate?: string;
}) {
  const session = await getSession();
  if (!session) return { data: [], total: 0, page: 1, totalPages: 0 };

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;

  const where: any = { userId: session.userId };

  if (params?.propertyId) {
    where.propertyId = params.propertyId;
  }

  if (params?.status) {
    where.status = params.status;
  }

  if (params?.billingType) {
    where.billingType = params.billingType;
  }

  if (params?.startDate && params?.endDate) {
    where.startDate = {
      gte: new Date(params.startDate),
    };
    where.endDate = {
      lte: new Date(params.endDate),
    };
  }

  if (params?.search) {
    where.OR = [
      { client: { name: { contains: params.search, mode: "insensitive" } } },
      { property: { name: { contains: params.search, mode: "insensitive" } } },
    ];
  }

  const [reservations, total] = await Promise.all([
    prisma.reservation.findMany({
      where,
      skip,
      take: limit,
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
            paymentType: true,
            title: true,
            description: true,
            amount: true,
            status: true,
            method: true,
            initPoint: true,
            expiresAt: true,
            installmentIndex: true,
            dueDate: true,
            paidAt: true,
            receiptUrl: true,
          },
        },
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.reservation.count({ where }),
  ]);

  const data = reservations.map((r) => ({
    id: r.id,
    userId: r.userId,
    propertyId: r.propertyId,
    clientId: r.clientId,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    billingType: r.billingType,
    unitsBooked: r.unitsBooked,
    totalPrice: String(r.totalPrice),
    status: r.status,
    bookingAirbnb: r.bookingAirbnb,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    property: {
      id: r.property.id,
      name: r.property.name,
      color: r.property.color,
      dailyPrice: String(r.property.dailyPrice),
      monthlyPrice: r.property.monthlyPrice ? String(r.property.monthlyPrice) : null,
      unitsAvailable: r.property.unitsAvailable,
    },
    client: {
      id: r.client.id,
      name: r.client.name,
      email: r.client.email,
      phone: r.client.phone,
    },
    payments: r.payments.map((p) => ({
      id: p.id,
      paymentType: p.paymentType,
      title: p.title ?? null,
      description: p.description ?? null,
      amount: String(p.amount),
      status: p.status,
      method: p.method,
      initPoint: p.initPoint || null,
      expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
      installmentIndex: p.installmentIndex,
      dueDate: p.dueDate ? p.dueDate.toISOString() : null,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      receiptUrl: p.receiptUrl || null,
    })),
  }));

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
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
    id: reservation.id,
    userId: reservation.userId,
    propertyId: reservation.propertyId,
    clientId: reservation.clientId,
    startDate: reservation.startDate.toISOString(),
    endDate: reservation.endDate.toISOString(),
    billingType: reservation.billingType,
    unitsBooked: reservation.unitsBooked,
    totalPrice: String(reservation.totalPrice),
    status: reservation.status,
    bookingAirbnb: reservation.bookingAirbnb,
    notes: reservation.notes,
    createdAt: reservation.createdAt.toISOString(),
    property: {
      id: reservation.property.id,
      name: reservation.property.name,
      type: reservation.property.type,
      color: reservation.property.color,
      dailyPrice: String(reservation.property.dailyPrice),
      monthlyPrice: reservation.property.monthlyPrice ? String(reservation.property.monthlyPrice) : null,
      unitsAvailable: reservation.property.unitsAvailable,
      amenities: reservation.property.amenities,
      mainImage: reservation.property.mainImage,
      images: reservation.property.images,
      userId: reservation.property.userId,
      createdAt: reservation.property.createdAt.toISOString(),
    },
    client: {
      id: reservation.client.id,
      name: reservation.client.name,
      email: reservation.client.email,
      phone: reservation.client.phone,
      rut: reservation.client.rut,
      notes: reservation.client.notes,
      userId: reservation.client.userId,
      createdAt: reservation.client.createdAt.toISOString(),
    },
    payments: reservation.payments
      .filter((p) => !p.deletedAt)
      .map((p) => ({
        id: p.id,
        reservationId: p.reservationId,
        paymentType: p.paymentType,
        title: p.title ?? null,
        description: p.description ?? null,
        amount: String(p.amount),
        status: p.status,
        method: p.method,
        initPoint: p.initPoint || null,
        expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
        installmentIndex: p.installmentIndex,
        dueDate: p.dueDate ? p.dueDate.toISOString() : null,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        receiptUrl: p.receiptUrl || null,
        mercadoPagoId: p.mercadoPagoId || null,
        deletedAt: null,
      })),
    changes: reservation.changes.map((c) => ({
      id: c.id,
      reservationId: c.reservationId,
      field: c.field,
      oldValue: c.oldValue,
      newValue: c.newValue,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

function calculateEndDate(startDate: Date, months: number): Date {
  return addDays(addMonths(startDate, months), -1);
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
    const monthlyCount = months ?? Math.max(1, differenceInMonths(endDate, startDate));
    return Number(property.monthlyPrice || 0) * monthlyCount * unitsBooked;
  }

  const nights = differenceInDays(endDate, startDate) + 1;
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

  const property = await prisma.property.findUnique({
    where: { id: validated.propertyId },
  });

  if (!property) {
    return { error: "Propiedad no encontrada" };
  }

  let startDate = new Date(validated.startDate);
  let endDate = new Date(validated.endDate);

  if (validated.billingType === 'MONTHLY') {
    if (!property.monthlyPrice) {
      return { error: "Esta propiedad no tiene precio mensual configurado" };
    }
    endDate = calculateEndDate(startDate, validated.months || 1);
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

  const reservation = await prisma.$transaction(async (tx) => {
    const newReservation = await tx.reservation.create({
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
        reservationId: newReservation.id,
        field: "created",
        oldValue: null,
        newValue: "Reservation created",
      },
    });

    if (validated.billingType === 'MONTHLY') {
      const paymentInputs = generateMonthlyPayments(
        startDate,
        validated.months || 1,
        property.monthlyPrice!,
        validated.unitsBooked
      );

      for (const paymentInput of paymentInputs) {
        await tx.payment.create({
          data: {
            reservationId: newReservation.id,
            amount: paymentInput.amount,
            method: paymentInput.method,
            status: paymentInput.status,
            dueDate: paymentInput.dueDate,
            installmentIndex: paymentInput.installmentIndex,
          },
        });
      }
    }

    return newReservation;
  });

  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return { success: true, reservation };
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

  await prisma.$transaction(async (tx) => {
    await tx.reservationChange.create({
      data: {
        reservationId: id,
        field: "status",
        oldValue: existing.status,
        newValue: "CANCELLED",
      },
    });

    if (reason) {
      await tx.reservationChange.create({
        data: {
          reservationId: id,
          field: "cancellation_reason",
          oldValue: null,
          newValue: reason,
        },
      });
    }

    await tx.reservation.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await tx.payment.deleteMany({
      where: {
        reservationId: id,
        status: "PENDING",
      },
    });
  });

  revalidatePath("/reservations");
  revalidatePath("/calendar");

  return { success: true, reservation: { ...existing, status: "CANCELLED" } };
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
      billingType: true,
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
    id: r.id,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    status: r.status,
    billingType: r.billingType,
    totalPrice: Number(r.totalPrice),
    property: {
      id: r.property.id,
      name: r.property.name,
      color: r.property.color,
    },
    client: {
      name: r.client.name,
    },
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
    id: r.id,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    status: r.status,
    totalPrice: Number(r.totalPrice),
    property: {
      id: r.property.id,
      name: r.property.name,
      color: r.property.color,
    },
    client: {
      name: r.client.name,
    },
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
