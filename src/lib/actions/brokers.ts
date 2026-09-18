"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { brokerSchema, type BrokerInput } from "@/lib/validations/broker";
import { revalidatePath } from "next/cache";
import type { PaginatedResponse } from "@/types/pagination";
import { ZodError } from "zod";

/**
 * CRUD de captadores. Calcado de `clients.ts`, con tres diferencias que salen
 * de ADR-0040:
 *
 * - **Sin límite de plan** (§9): los captadores no consumen el cupo de FREE ni
 *   agregan uno nuevo. Hay un test que lo fija.
 * - **No se borran, se desactivan** (`active: false`): `Reservation → Broker`
 *   es RESTRICT, y perder el `brokerId` de una reserva histórica borraría la
 *   evidencia de una comisión ya pagada. `deleteBroker` solo pasa cuando el
 *   captador no tiene ninguna reserva, para deshacer un error de tipeo.
 * - **Editar el porcentaje no mueve nada de lo ya registrado** (§2): las
 *   reservas llevan su propia `commissionRate` congelada. Esta columna es solo
 *   el valor que se precarga la próxima vez.
 */

/**
 * Resultado de las acciones que escriben. Explícito y no inferido: el parseo
 * vive en un helper aparte, así que TypeScript no normaliza el union de los
 * `return` y `result.error` deja de ser accesible en los callers.
 */
export type BrokerActionResult =
  | { success: true; error?: undefined }
  | { error: string; details?: unknown; success?: undefined };

export interface BrokerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rut: string | null;
  defaultCommissionRate: number;
  active: boolean;
  notes: string | null;
  createdAt: string;
  reservationsCount: number;
}

export async function getBrokers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  /** Si es true, oculta los desactivados. Por defecto vienen todos. */
  onlyActive?: boolean;
}): Promise<PaginatedResponse<BrokerRow> | []> {
  const session = await getSession();
  if (!session) return [];

  const page = params?.page || 1;
  const limit = params?.limit || 10;
  const skip = (page - 1) * limit;

  const where: Prisma.BrokerWhereInput = { userId: session.userId };
  if (params?.onlyActive) where.active = true;
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [brokers, total] = await Promise.all([
    prisma.broker.findMany({
      where,
      include: { reservations: { select: { id: true } } },
      // Los activos primero: un captador desactivado es historia, no trabajo.
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
      skip,
      take: limit,
    }),
    prisma.broker.count({ where }),
  ]);

  return {
    data: brokers.map((broker) => ({
      id: broker.id,
      name: broker.name,
      email: broker.email,
      phone: broker.phone,
      rut: broker.rut,
      defaultCommissionRate: Number(broker.defaultCommissionRate),
      active: broker.active,
      notes: broker.notes,
      createdAt: broker.createdAt.toISOString(),
      reservationsCount: broker.reservations.length,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export interface BrokersKpis {
  total: number;
  active: number;
  /** Reservas captadas por cualquiera de ellos, histórico. */
  reservationsBrought: number;
  /** Promedio de los porcentajes por defecto de los activos. */
  averageRate: number;
}

export async function getBrokersKpis(): Promise<BrokersKpis> {
  const session = await getSession();
  if (!session) {
    return { total: 0, active: 0, reservationsBrought: 0, averageRate: 0 };
  }

  const [total, active, reservationsBrought, rateAggregate] = await Promise.all([
    prisma.broker.count({ where: { userId: session.userId } }),
    prisma.broker.count({ where: { userId: session.userId, active: true } }),
    prisma.reservation.count({
      where: { userId: session.userId, brokerId: { not: null } },
    }),
    prisma.broker.aggregate({
      where: { userId: session.userId, active: true },
      _avg: { defaultCommissionRate: true },
    }),
  ]);

  return {
    total,
    active,
    reservationsBrought,
    averageRate: Number(rateAggregate._avg.defaultCommissionRate ?? 0),
  };
}

/**
 * Captadores activos para el selector del formulario de reserva (slice 3).
 * Sin paginar: son pocos y el selector los necesita todos.
 */
export async function getActiveBrokers(): Promise<
  { id: string; name: string; defaultCommissionRate: number }[]
> {
  const session = await getSession();
  if (!session) return [];

  const brokers = await prisma.broker.findMany({
    where: { userId: session.userId, active: true },
    select: { id: true, name: true, defaultCommissionRate: true },
    orderBy: { name: "asc" },
  });

  return brokers.map((b) => ({
    id: b.id,
    name: b.name,
    defaultCommissionRate: Number(b.defaultCommissionRate),
  }));
}

export async function getBrokerById(id: string) {
  const session = await getSession();
  if (!session) return null;

  return prisma.broker.findFirst({
    where: { id, userId: session.userId },
  });
}

function parseBroker(data: unknown):
  | { ok: true; value: BrokerInput }
  | { ok: false; error: BrokerActionResult } {
  try {
    return { ok: true, value: brokerSchema.parse(data) };
  } catch (e) {
    if (e instanceof ZodError) {
      return { ok: false, error: { error: "Datos inválidos", details: e.errors } };
    }
    return { ok: false, error: { error: "Datos inválidos" } };
  }
}

/** Un email vacío del formulario se guarda como ausente, no como "". */
function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  return trimmed ? trimmed : null;
}

export async function createBroker(data: unknown): Promise<BrokerActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const parsed = parseBroker(data);
  if (!parsed.ok) return parsed.error;
  const validated = parsed.value;

  // Sin chequeo de plan a propósito (ADR-0040 §9).
  try {
    await prisma.broker.create({
      data: {
        userId: session.userId,
        name: validated.name,
        email: normalizeEmail(validated.email),
        phone: validated.phone ?? null,
        rut: validated.rut ?? null,
        defaultCommissionRate: new Prisma.Decimal(validated.defaultCommissionRate),
        active: validated.active ?? true,
        notes: validated.notes ?? null,
      },
    });
  } catch {
    return { error: "Error al crear el captador" };
  }

  revalidatePath("/brokers");
  return { success: true };
}

export async function updateBroker(
  id: string,
  data: unknown,
): Promise<BrokerActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const parsed = parseBroker(data);
  if (!parsed.ok) return parsed.error;
  const validated = parsed.value;

  const existing = await prisma.broker.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return { error: "Captador no encontrado" };

  // Cambiar el porcentaje acá NO toca las reservas ya registradas: cada una
  // lleva su `commissionRate` congelada (ADR-0040 §2).
  await prisma.broker.update({
    where: { id },
    data: {
      name: validated.name,
      email: normalizeEmail(validated.email),
      phone: validated.phone ?? null,
      rut: validated.rut ?? null,
      defaultCommissionRate: new Prisma.Decimal(validated.defaultCommissionRate),
      ...(validated.active === undefined ? {} : { active: validated.active }),
      notes: validated.notes ?? null,
    },
  });

  revalidatePath("/brokers");
  return { success: true };
}

/** Activar o desactivar. Es la baja normal de un captador con historia. */
export async function setBrokerActive(
  id: string,
  active: boolean,
): Promise<BrokerActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const existing = await prisma.broker.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return { error: "Captador no encontrado" };

  await prisma.broker.update({ where: { id }, data: { active } });

  revalidatePath("/brokers");
  return { success: true };
}

/**
 * Borrado real, solo para un captador sin ninguna reserva.
 *
 * Con reservas se rechaza acá en vez de dejar que la base tire el RESTRICT:
 * el owner necesita leer por qué, y la respuesta es desactivarlo.
 */
export async function deleteBroker(id: string): Promise<BrokerActionResult> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const existing = await prisma.broker.findFirst({
    where: { id, userId: session.userId },
    include: { _count: { select: { reservations: true } } },
  });
  if (!existing) return { error: "Captador no encontrado" };

  if (existing._count.reservations > 0) {
    return {
      error:
        "Este captador tiene reservas asociadas y no se puede eliminar. Desactívalo para dejar de asignarlo a reservas nuevas.",
    };
  }

  await prisma.broker.delete({ where: { id } });

  revalidatePath("/brokers");
  return { success: true };
}
