"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { supportTicketSchema, supportMessageSchema, type SupportTicketInput, type AttachmentInput } from "@/lib/validations/support";
import { computeHasUnread, type UnreadRole } from "@/lib/support/unread";
import {
  getOwnerSupportTickets,
  getOwnerSupportTicketDetail,
  buildUnreadMap,
  resolveAffectedEntityOwner,
  countTicketsByStatusForOwner,
  getOwnerTicketsForResponseTime,
} from "@/lib/support/queries";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { PaginatedResponse } from "@/types/pagination";

export interface SupportTicketRow {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  lastActivityAt: string;
  createdAt: string;
  hasUnread?: boolean;
}

export interface SupportAttachment {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

export interface AffectedEntityRef {
  type: "RESERVATION" | "PAYMENT" | "PROPERTY";
  id: string;
}

export interface SupportTicketDetail {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  affectedEntity: AffectedEntityRef | null;
  lastActivityAt: string;
  createdAt: string;
  messages: Array<{
    id: string;
    authorId: string;
    content: string;
    createdAt: string;
    attachments: SupportAttachment[];
    author: {
      id: string;
      name: string | null;
      email: string;
    };
  }>;
}

export async function createSupportTicket(data: unknown) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };
  if (session.role !== "OWNER") return { error: "Solo los propietarios pueden crear tickets" };

  let validated: SupportTicketInput;
  try {
    validated = supportTicketSchema.parse(data);
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: "Datos inválidos", details: e.errors };
    }
    return { error: "Datos inválidos" };
  }

  if (validated.affectedEntityType && validated.affectedEntityId) {
    let entityOwnerId: string | null = null;

    if (validated.affectedEntityType === "RESERVATION") {
      const reservation = await prisma.reservation.findUnique({
        where: { id: validated.affectedEntityId },
        select: { userId: true },
      });
      if (!reservation) return { error: "La entidad afectada no existe" };
      entityOwnerId = reservation.userId;
    } else if (validated.affectedEntityType === "PAYMENT") {
      const payment = await prisma.payment.findUnique({
        where: { id: validated.affectedEntityId },
        select: { reservation: { select: { userId: true } } },
      });
      if (!payment) return { error: "La entidad afectada no existe" };
      entityOwnerId = payment.reservation.userId;
    } else if (validated.affectedEntityType === "PROPERTY") {
      const property = await prisma.property.findUnique({
        where: { id: validated.affectedEntityId },
        select: { userId: true },
      });
      if (!property) return { error: "La entidad afectada no existe" };
      entityOwnerId = property.userId;
    }

    if (entityOwnerId !== session.userId) {
      return { error: "La entidad afectada no pertenece a este propietario" };
    }
  }

  const createData: Prisma.SupportTicketUncheckedCreateInput = {
    userId: session.userId,
    subject: validated.subject,
    description: validated.description,
    priority: validated.priority,
    category: validated.category,
  };

  if (validated.affectedEntityType === "RESERVATION" && validated.affectedEntityId) {
    createData.affectedReservationId = validated.affectedEntityId;
  } else if (validated.affectedEntityType === "PAYMENT" && validated.affectedEntityId) {
    createData.affectedPaymentId = validated.affectedEntityId;
  } else if (validated.affectedEntityType === "PROPERTY" && validated.affectedEntityId) {
    createData.affectedPropertyId = validated.affectedEntityId;
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const createdTicket = await tx.supportTicket.create({
      data: createData,
    });

    await tx.supportMessage.create({
      data: {
        supportTicketId: createdTicket.id,
        authorId: session.userId,
        content: validated.description,
        ...(validated.images && validated.images.length > 0
          ? {
              attachments: {
                create: validated.images.map((img) => ({
                  url: img.url,
                  fileName: img.fileName,
                  fileSize: img.fileSize,
                })),
              },
            }
          : {}),
      },
    });

    return createdTicket;
  });

  revalidatePath("/support");
  return { success: true, ticket };
}

export async function getSupportTickets(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PaginatedResponse<SupportTicketRow> | []> {
  const session = await getSession();
  if (!session) return [];

  const page = params?.page || 1;
  const limit = params?.limit || 10;

  const status = params?.status && params.status !== "ALL"
    ? (params.status as Prisma.SupportTicketWhereInput["status"])
    : undefined;

  const { tickets, total } = await getOwnerSupportTickets(
    session.userId,
    { page, limit, status: status as never },
  );

  const readMap = await buildUnreadMap(
    session.userId,
    tickets.map((t) => t.id),
  );

  return {
    data: tickets.map((ticket) => {
      const lastReadAt = readMap.get(ticket.id);
      const hasUnread = computeHasUnread(
        ticket.messages.map((msg) => ({
          authorId: msg.authorId,
          authorRole: msg.author.role as UnreadRole,
          createdAt: msg.createdAt,
        })),
        { role: "OWNER" },
        lastReadAt,
      );

      return {
        id: ticket.id,
        userId: ticket.userId,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        lastActivityAt: ticket.lastActivityAt.toISOString(),
        createdAt: ticket.createdAt.toISOString(),
        hasUnread,
      };
    }),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getSupportTicketDetail(ticketId: string) {
  const session = await getSession();
  if (!session) return null;

  const ticket = await getOwnerSupportTicketDetail(session.userId, ticketId);

  if (!ticket) return null;

  const affectedEntity = resolveAffectedEntityOwner(ticket);

  return {
    id: ticket.id,
    userId: ticket.userId,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    affectedEntity,
    lastActivityAt: ticket.lastActivityAt.toISOString(),
    createdAt: ticket.createdAt.toISOString(),
      messages: ticket.messages.map((msg) => ({
        id: msg.id,
        authorId: msg.authorId,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
        author: {
          id: msg.author.id,
          name: msg.author.name,
          email: msg.author.email,
        },
        attachments: msg.attachments.map((att) => ({
          id: att.id,
          url: att.url,
          fileName: att.fileName,
          fileSize: att.fileSize,
          createdAt: att.createdAt.toISOString(),
        })),
      })),
  };
}

export async function addSupportTicketMessage(ticketId: string, content: string, images?: AttachmentInput[]) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  try {
    supportMessageSchema.parse({ content, images: images ?? undefined });
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: "Datos inválidos", details: e.errors };
    }
    return { error: "Datos inválidos" };
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId, userId: session.userId },
  });

  if (!ticket) return { error: "Ticket no encontrado" };

  const shouldReopen = ticket.status === "CLOSED";

  const now = new Date();

  if (shouldReopen) {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "OPEN", lastActivityAt: now },
    });
  } else {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { lastActivityAt: now },
    });
  }

  await prisma.supportMessage.create({
    data: {
      supportTicketId: ticketId,
      authorId: session.userId,
      content,
      ...(images && images.length > 0
        ? {
            attachments: {
              create: images.map((img) => ({
                url: img.url,
                fileName: img.fileName,
                fileSize: img.fileSize,
              })),
            },
          }
        : {}),
    },
  });

  revalidatePath("/support");
  revalidatePath(`/support/${ticketId}`);
  return { success: true };
}

export interface EntityOption {
  id: string;
  label: string;
}

export async function getUserEntityOptions(entityType: "RESERVATION" | "PAYMENT" | "PROPERTY") {
  const session = await getSession();
  if (!session) return [];

  switch (entityType) {
    case "PROPERTY": {
      const properties = await prisma.property.findMany({
        where: { userId: session.userId },
        select: { id: true, name: true },
      });
      return properties.map((p): EntityOption => ({ id: p.id, label: p.name }));
    }
    case "RESERVATION": {
      const reservations = await prisma.reservation.findMany({
        where: { userId: session.userId },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          client: { select: { name: true } },
          property: { select: { name: true } },
        },
      });
      return reservations.map((r): EntityOption => ({
        id: r.id,
        label: `Reserva #${r.id.slice(0, 8)} - ${r.client.name} - ${r.property.name}`,
      }));
    }
    case "PAYMENT": {
      const payments = await prisma.payment.findMany({
        where: { reservation: { userId: session.userId }, deletedAt: null },
        select: {
          id: true,
          amount: true,
          reservation: {
            select: {
              client: { select: { name: true } },
              property: { select: { name: true } },
            },
          },
        },
      });
      return payments.map((p): EntityOption => ({
        id: p.id,
        label: `Pago #${p.id.slice(0, 8)} - ${p.reservation.client.name} - ${p.reservation.property.name}`,
      }));
    }
    default:
      return [];
  }
}

export interface SupportTicketsKpis {
  openCount: number;
  resolvedCount: number;
  avgResponseHours: number | null;
}

export async function getSupportTicketsKpis(): Promise<SupportTicketsKpis> {
  const session = await getSession();
  if (!session) return { openCount: 0, resolvedCount: 0, avgResponseHours: null };

  const [{ openCount, resolvedCount }, ticketsWithMessages] = await Promise.all([
    countTicketsByStatusForOwner(session.userId),
    getOwnerTicketsForResponseTime(session.userId),
  ]);

  const responseDelaysMs: number[] = [];
  for (const ticket of ticketsWithMessages) {
    const firstAdminMessage = ticket.messages.find((m) => m.author.role === "SUPER_ADMIN");
    if (firstAdminMessage) {
      const delay = firstAdminMessage.createdAt.getTime() - ticket.createdAt.getTime();
      if (delay >= 0) responseDelaysMs.push(delay);
    }
  }

  const avgResponseHours = responseDelaysMs.length === 0
    ? null
    : responseDelaysMs.reduce((s, d) => s + d, 0) / responseDelaysMs.length / (1000 * 60 * 60);

  return { openCount, resolvedCount, avgResponseHours };
}

export async function closeSupportTicket(ticketId: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId, userId: session.userId },
  });

  if (!ticket) return { error: "Ticket no encontrado" };

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "CLOSED", lastActivityAt: new Date() },
  });

  revalidatePath("/support");
  revalidatePath(`/support/${ticketId}`);
  return { success: true };
}
