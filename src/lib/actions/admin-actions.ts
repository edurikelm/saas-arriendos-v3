"use server";

import { prisma } from "@/lib/db/prisma";
import { isSuperAdmin } from "@/lib/actions/super-admin";
import { getSession } from "@/lib/actions/auth";

export interface ActionLogDetails {
  before?: string;
  after?: string;
  [key: string]: unknown;
}

export interface ActionLogEntry {
  id: string;
  adminId: string;
  targetId: string;
  action: string;
  details: string | null;
  createdAt: Date;
  admin: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface LogAdminActionParams {
  targetId: string;
  action: string;
  details?: ActionLogDetails;
}

export async function logAdminAction({ targetId, action, details }: LogAdminActionParams): Promise<void> {
  const session = await getSession();
  if (!session) return;

  await prisma.adminActionLog.create({
    data: {
      adminId: session.userId,
      targetId,
      action,
      details: details ? JSON.stringify(details) : null,
    },
  });
}

export async function getAdminActionLogs(targetId: string): Promise<ActionLogEntry[] | null> {
  if (!(await isSuperAdmin())) return null;

  const logs = await prisma.adminActionLog.findMany({
    where: { targetId },
    include: {
      admin: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return logs;
}
