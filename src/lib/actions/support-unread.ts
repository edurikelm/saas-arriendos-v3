"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
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

  let count = 0;

  for (const ticket of tickets) {
    const read = await prisma.supportTicketRead.findUnique({
      where: {
        ticketId_userId: { ticketId: ticket.id, userId: session.userId },
      },
    });

    const hasUnreadFromOther = computeHasUnread(
      ticket.messages.map((msg) => ({
        authorId: msg.authorId,
        authorRole: msg.author.role as UnreadRole,
        createdAt: msg.createdAt,
      })),
      { role: viewerRole },
      read?.lastReadAt,
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
