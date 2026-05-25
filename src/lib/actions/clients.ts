"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { clientSchema, type ClientInput } from "@/lib/validations/client";
import { revalidatePath } from "next/cache";

const FREE_CLIENT_LIMIT = 5;

export async function getClients() {
  const session = await getSession();
  if (!session) return [];

  const clients = await prisma.reservationClient.findMany({
    where: { userId: session.userId },
    include: {
      reservations: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    rut: client.rut,
    notes: client.notes,
    createdAt: client.createdAt.toISOString(),
    userId: client.userId,
    reservationsCount: client.reservations.length,
  }));
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
  } catch (e: any) {
    if (e.name === 'ZodError') {
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
  } catch (e: any) {
    if (e.name === 'ZodError') {
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