"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";

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

  return reservations;
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

  return reservations;
}