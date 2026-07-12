"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { computeHasUnread, type UnreadRole } from "@/lib/support/unread";

export async function getUnreadSupportTicketCount(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;

  const viewerRole = session.role as UnreadRole;

  const tickets = await prisma.supportTicket.findMany({
    where: viewerRole === "SUPER_ADMIN" ? {} : { userId: session.userId },
    include: {
      messages: {
        select: { id: true, authorId: true, createdAt: true, author: { select: { role: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (tickets.length === 0) return 0;

  // Batched read lookup — one query instead of N.
  const reads = await prisma.supportTicketRead.findMany({
    where: {
      userId: session.userId,
      ticketId: { in: tickets.map((t) => t.id) },
    },
    select: { ticketId: true, lastReadAt: true },
  });
  const readMap = new Map(reads.map((r) => [r.ticketId, r.lastReadAt]));

  let count = 0;

  for (const ticket of tickets) {
    const lastReadAt = readMap.get(ticket.id);

    const hasUnreadFromOther = computeHasUnread(
      ticket.messages.map((msg) => ({
        authorId: msg.authorId,
        authorRole: msg.author.role as UnreadRole,
        createdAt: msg.createdAt,
      })),
      { role: viewerRole },
      lastReadAt,
    );

    if (hasUnreadFromOther) {
      count++;
    }
  }

  return count;
}

export async function markSupportTicketAsRead(ticketId: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { userId: true },
  });
  if (!ticket) return { error: "Ticket no encontrado" };
  if (ticket.userId !== session.userId && session.role !== "SUPER_ADMIN") {
    return { error: "No autorizado" };
  }

  await prisma.supportTicketRead.upsert({
    where: {
      ticketId_userId: { ticketId, userId: session.userId },
    },
    update: { lastReadAt: new Date() },
    create: { ticketId, userId: session.userId, lastReadAt: new Date() },
  });

  return { success: true };
}
