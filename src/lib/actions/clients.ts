"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { clientSchema, type ClientInput } from "@/lib/validations/client";
import { revalidatePath } from "next/cache";
import type { PaginatedResponse } from "@/types/pagination";
import { ZodError } from "zod";

const FREE_CLIENT_LIMIT = 5;

export interface ClientRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  rut: string | null;
  notes: string | null;
  createdAt: string;
  userId: string;
  reservationsCount: number;
}

export async function getClients(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedResponse<ClientRow> | []> {
  const session = await getSession();
  if (!session) return [];

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;

  const where: Prisma.ReservationClientWhereInput = { userId: session.userId };
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [clients, total] = await Promise.all([
    prisma.reservationClient.findMany({
      where,
      include: { reservations: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.reservationClient.count({ where }),
  ]);

  return {
    data: clients.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      rut: client.rut,
      notes: client.notes,
      createdAt: client.createdAt.toISOString(),
      userId: client.userId,
      reservationsCount: client.reservations.length,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export interface ClientsKpis {
  total: number;
  active: number;
  withoutReservations: number;
  newThisMonth: number;
}

export async function getClientsKpis(): Promise<ClientsKpis> {
  const session = await getSession();
  if (!session) {
    return { total: 0, active: 0, withoutReservations: 0, newThisMonth: 0 };
  }

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, active, newThisMonth] = await Promise.all([
    prisma.reservationClient.count({ where: { userId: session.userId } }),
    prisma.reservationClient.count({
      where: { userId: session.userId, reservations: { some: {} } },
    }),
    prisma.reservationClient.count({
      where: { userId: session.userId, createdAt: { gte: startOfThisMonth } },
    }),
  ]);

  return {
    total,
    active,
    withoutReservations: total - active,
    newThisMonth,
  };
}

export async function getClientById(id: string) {
  const session = await getSession();
  if (!session) return null;

  const client = await prisma.reservationClient.findFirst({
    where: {
      id,
      userId: session.userId,
    },
  });

  return client;
}

export async function getClientCount() {
  const session = await getSession();
  if (!session) return 0;

  return prisma.reservationClient.count({
    where: { userId: session.userId },
  });
}

export async function createClient(data: unknown) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  let validated: ClientInput;
  try {
    validated = clientSchema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: "Datos inválidos", details: e.errors };
    }
    return { error: "Datos inválidos" };
  }

  if (session.plan === "FREE") {
    const count = await prisma.reservationClient.count({
      where: { userId: session.userId },
    });

    if (count >= FREE_CLIENT_LIMIT) {
      return {
        error: `Has alcanzado el límite de ${FREE_CLIENT_LIMIT} clientes de tu plan FREE. Haz upgrade a PRO para clientes ilimitados.`,
        upgrade: true,
      };
    }
  }

  let client;
  try {
    client = await prisma.reservationClient.create({
      data: {
        userId: session.userId,
        name: validated.name,
        email: validated.email,
        phone: validated.phone ?? null,
        rut: validated.rut ?? null,
        notes: validated.notes ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe un cliente con ese email" };
    }
    return { error: "Error al crear el cliente" };
  }

  revalidatePath("/clients");
  return { success: true, client };
}

export async function updateClient(id: string, data: unknown) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  let validated: ClientInput;
  try {
    validated = clientSchema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: "Datos inválidos", details: e.errors };
    }
    return { error: "Datos inválidos" };
  }

  const existing = await prisma.reservationClient.findFirst({
    where: { id, userId: session.userId },
  });

  if (!existing) return { error: "Cliente no encontrado" };

  const client = await prisma.reservationClient.update({
    where: { id },
    data: {
      name: validated.name,
      email: validated.email,
      phone: validated.phone ?? null,
      rut: validated.rut ?? null,
      notes: validated.notes ?? null,
    },
  });

  revalidatePath("/clients");
  return { success: true, client };
}

export async function deleteClient(id: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const existing = await prisma.reservationClient.findFirst({
    where: { id, userId: session.userId },
  });

  if (!existing) return { error: "Cliente no encontrado" };

  await prisma.reservationClient.delete({
    where: { id },
  });

  revalidatePath("/clients");
  return { success: true };
}