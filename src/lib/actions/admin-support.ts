"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession, getSuperAdminSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { ticketPriorityEnum, ticketCategoryEnum, supportMessageSchema } from "@/lib/validations/support";
import { computeHasUnread, type UnreadRole } from "@/lib/support/unread";
import {
  getAdminSupportTickets,
  getAdminSupportTicketDetail as getAdminSupportTicketDetailQuery,
  buildUnreadMap,
  resolveAffectedEntityAdmin,
  type StatusFilter,
  type AdminTicketFilters,
} from "@/lib/support/queries";
import type { PaginatedResponse } from "@/types/pagination";
import type { Prisma, TicketCategory, TicketPriority } from "@prisma/client";

export interface AdminSupportTicketRow {
  id: string;
  userId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  lastActivityAt: string;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string;
  ownerPlan: string | null;
  messageCount: number;
  hasUnread?: boolean;
}

export interface AdminSupportAttachment {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

export interface AdminSupportMessage {
  id: string;
  supportTicketId: string;
  authorId: string;
  content: string;
  createdAt: string;
  attachments: AdminSupportAttachment[];
  author: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface AdminTicketDetail {
  ticket: {
    id: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    createdAt: string;
    lastActivityAt: string;
  };
  messages: AdminSupportMessage[];
  owner: {
    id: string;
    name: string | null;
    email: string;
    plan: string | null;
    status: string;
  };
  affectedEntity: {
    type: "RESERVATION" | "PAYMENT" | "PROPERTY";
    id: string;
  } | null;
}

export async function getAllSupportTickets(
  statusFilter?: StatusFilter,
  filters?: AdminTicketFilters
): Promise<PaginatedResponse<AdminSupportTicketRow>> {
  const session = await getSuperAdminSession();
  if (!session) {
    return { data: [], total: 0, page: 1, totalPages: 0 };
  }

  const { tickets, total } = await getAdminSupportTickets({
    statusFilter: statusFilter as StatusFilter | undefined,
    filters: filters as AdminTicketFilters | undefined,
  });

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
        { role: "SUPER_ADMIN" },
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
        ownerName: ticket.user.name,
        ownerEmail: ticket.user.email,
        ownerPlan: ticket.user.plan,
        messageCount: ticket._count.messages,
        hasUnread,
      };
    }),
    total,
    page: 1,
    totalPages: Math.ceil(total / 20),
  };
}

export async function getAdminSupportTicketDetail(ticketId: string): Promise<AdminTicketDetail | null> {
  const session = await getSuperAdminSession();
  if (!session) return null;

  const ticket = await getAdminSupportTicketDetailQuery(ticketId);

  if (!ticket) return null;

  const affectedEntity = resolveAffectedEntityAdmin(ticket);

  return {
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      createdAt: ticket.createdAt.toISOString(),
      lastActivityAt: ticket.lastActivityAt.toISOString(),
    },
    messages: ticket.messages.map((msg) => ({
      id: msg.id,
      supportTicketId: msg.supportTicketId,
      authorId: msg.authorId,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      attachments: msg.attachments.map((att) => ({
        id: att.id,
        url: att.url,
        fileName: att.fileName,
        fileSize: att.fileSize,
        createdAt: att.createdAt.toISOString(),
      })),
      author: {
        id: msg.author.id,
        name: msg.author.name,
        email: msg.author.email,
      },
    })),
    owner: {
      id: ticket.user.id,
      name: ticket.user.name,
      email: ticket.user.email,
      plan: ticket.user.plan,
      status: ticket.user.status,
    },
    affectedEntity,
  };
}

export async function respondToSupportTicket(
  ticketId: string,
  content: string,
  images?: Array<{ url: string; fileName: string; fileSize: number }>
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSuperAdminSession();
  if (!session) return { error: "No autorizado" };

  const messageParsed = supportMessageSchema.safeParse({
    content,
    images: images ?? undefined,
  });
  if (!messageParsed.success) {
    const firstIssue = messageParsed.error.errors[0];
    return { error: `${firstIssue.path.join(".") || "datos"}: ${firstIssue.message}` };
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) return { error: "Ticket no encontrado" };

  if (ticket.status === "CLOSED") {
    return { error: "No se puede responder un ticket cerrado" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.supportMessage.create({
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

    const updateData: Prisma.SupportTicketUpdateInput = {
      lastActivityAt: new Date(),
    };

    if (ticket.status === "OPEN") {
      updateData.status = "IN_PROGRESS";
    }

    await tx.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
    });
  });

  revalidatePath("/admin/support");
  return { success: true };
}

export async function resolveSupportTicket(
  ticketId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSuperAdminSession();
  if (!session) return { error: "No autorizado" };

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) return { error: "Ticket no encontrado" };

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: "RESOLVED",
      lastActivityAt: new Date(),
    },
  });

  revalidatePath("/admin/support");
  return { success: true };
}

export async function closeSupportTicket(
  ticketId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) return { error: "Ticket no encontrado" };

  const isOwner = ticket.userId === session.userId;
  const isAdmin = session.role === "SUPER_ADMIN";

  if (!isOwner && !isAdmin) {
    return { error: "No autorizado" };
  }

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status: "CLOSED",
      lastActivityAt: new Date(),
    },
  });

  revalidatePath("/admin/support");
  return { success: true };
}

export async function updateSupportTicketPriority(
  ticketId: string,
  priority: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSuperAdminSession();
  if (!session) return { error: "No autorizado" };

  const parsed = ticketPriorityEnum.safeParse(priority);
  if (!parsed.success) {
    return { error: "Prioridad inválida" };
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) return { error: "Ticket no encontrado" };

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { priority: parsed.data as TicketPriority },
  });

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  return { success: true };
}

export async function updateSupportTicketCategory(
  ticketId: string,
  category: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await getSuperAdminSession();
  if (!session) return { error: "No autorizado" };

  const parsed = ticketCategoryEnum.safeParse(category);
  if (!parsed.success) {
    return { error: "Categoría inválida" };
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) return { error: "Ticket no encontrado" };

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { category: parsed.data as TicketCategory },
  });

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticketId}`);
  return { success: true };
}
