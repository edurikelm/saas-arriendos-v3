"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";

export async function getUnreadSupportTicketCount(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;

  const isAdmin = session.role === "SUPER_ADMIN";

  const tickets = await prisma.supportTicket.findMany({
    where: isAdmin ? {} : { userId: session.userId },
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

    const hasUnreadFromOther = ticket.messages.some(
      (msg) =>
        (isAdmin ? msg.author.role === "OWNER" : msg.authorId !== session.userId) &&
        (!read || msg.createdAt > read.lastReadAt)
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
