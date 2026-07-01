"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { ZodError } from "zod";
import {
  createPropertyExportFeedInputSchema,
  regeneratePropertyExportFeedInputSchema,
  revokePropertyExportFeedInputSchema,
  type CreatePropertyExportFeedInput,
  type RegeneratePropertyExportFeedInput,
  type RevokePropertyExportFeedInput,
} from "@/lib/validations/property-export-feed";
import {
  generateExportToken,
  hashExportToken,
  getTokenLastFour,
} from "@/lib/ical/tokens";
import { revalidatePath } from "next/cache";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getFeedUrl(rawToken: string, channel: string): string {
  return `${APP_URL}/api/ical/export?token=${rawToken}&channel=${channel}`;
}

function buildFeedPreview(feed: {
  id: string;
  channel: string;
  tokenLastFour: string;
  createdAt: Date;
  lastRotatedAt: Date;
  lastFetchedAt: Date | null;
}) {
  return {
    id: feed.id,
    channel: feed.channel,
    tokenLastFour: feed.tokenLastFour,
    createdAt: feed.createdAt,
    lastRotatedAt: feed.lastRotatedAt,
    lastFetchedAt: feed.lastFetchedAt,
    urlPreview: `${APP_URL}/api/ical/export?channel=${feed.channel}&token=...${feed.tokenLastFour}`,
  };
}

export async function listPropertyExportFeeds(propertyId: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  // Validate property ownership
  const property = await prisma.property.findFirst({
    where: { id: propertyId, userId: session.userId },
    select: { id: true },
  });

  if (!property) {
    return { error: "Propiedad no encontrada" };
  }

  const feeds = await prisma.propertyExportFeed.findMany({
    where: { propertyId },
    orderBy: { createdAt: "desc" },
  });

  // Never return raw token, only metadata
  return feeds.map(buildFeedPreview);
}

export async function createPropertyExportFeed(
  input: CreatePropertyExportFeedInput
) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };
  if (session.plan !== "PRO")
    return { error: "Funcionalidad disponible solo para plan PRO" };

  let validated: CreatePropertyExportFeedInput;
  try {
    validated = createPropertyExportFeedInputSchema.parse(input);
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: "Datos inválidos", details: e.errors };
    }
    return { error: "Datos inválidos" };
  }

  // Validate property ownership
  const property = await prisma.property.findFirst({
    where: { id: validated.propertyId, userId: session.userId },
    select: { id: true },
  });

  if (!property) {
    return { error: "Propiedad no encontrada" };
  }

  // Check if feed already exists for this (property, channel)
  const existing = await prisma.propertyExportFeed.findUnique({
    where: {
      propertyId_channel: {
        propertyId: validated.propertyId,
        channel: validated.channel,
      },
    },
  });

  if (existing) {
    return { error: "Ya existe un feed para este canal en esta propiedad" };
  }

  // Generate token
  const rawToken = generateExportToken();
  const tokenHash = hashExportToken(rawToken);
  const tokenLastFour = getTokenLastFour(rawToken);

  const feed = await prisma.propertyExportFeed.create({
    data: {
      propertyId: validated.propertyId,
      channel: validated.channel,
      tokenHash,
      tokenLastFour,
    },
  });

  revalidatePath(`/properties/${validated.propertyId}`);

  return {
    success: true,
    rawToken,
    feed: {
      ...buildFeedPreview(feed),
      urlPreview: getFeedUrl(rawToken, validated.channel),
    },
  };
}

export async function regeneratePropertyExportFeed(
  input: RegeneratePropertyExportFeedInput
) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };
  if (session.plan !== "PRO")
    return { error: "Funcionalidad disponible solo para plan PRO" };

  let validated: RegeneratePropertyExportFeedInput;
  try {
    validated = regeneratePropertyExportFeedInputSchema.parse(input);
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: "Datos inválidos", details: e.errors };
    }
    return { error: "Datos inválidos" };
  }

  // Validate property ownership
  const property = await prisma.property.findFirst({
    where: { id: validated.propertyId, userId: session.userId },
    select: { id: true },
  });

  if (!property) {
    return { error: "Propiedad no encontrada" };
  }

  // Check if feed exists
  const existing = await prisma.propertyExportFeed.findUnique({
    where: {
      propertyId_channel: {
        propertyId: validated.propertyId,
        channel: validated.channel,
      },
    },
  });

  if (!existing) {
    return { error: "No existe un feed para este canal en esta propiedad" };
  }

  // Generate new token (old one is immediately invalid)
  const rawToken = generateExportToken();
  const tokenHash = hashExportToken(rawToken);
  const tokenLastFour = getTokenLastFour(rawToken);

  const feed = await prisma.propertyExportFeed.update({
    where: { id: existing.id },
    data: {
      tokenHash,
      tokenLastFour,
      lastRotatedAt: new Date(),
      isRevoked: false,
    },
  });

  revalidatePath(`/properties/${validated.propertyId}`);

  return {
    success: true,
    rawToken,
    feed: {
      ...buildFeedPreview(feed),
      urlPreview: getFeedUrl(rawToken, validated.channel),
    },
  };
}

export async function revokePropertyExportFeed(
  input: RevokePropertyExportFeedInput
) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };
  if (session.plan !== "PRO")
    return { error: "Funcionalidad disponible solo para plan PRO" };

  let validated: RevokePropertyExportFeedInput;
  try {
    validated = revokePropertyExportFeedInputSchema.parse(input);
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: "Datos inválidos", details: e.errors };
    }
    return { error: "Datos inválidos" };
  }

  // Validate property ownership
  const property = await prisma.property.findFirst({
    where: { id: validated.propertyId, userId: session.userId },
    select: { id: true },
  });

  if (!property) {
    return { error: "Propiedad no encontrada" };
  }

  // Check if feed exists
  const existing = await prisma.propertyExportFeed.findUnique({
    where: {
      propertyId_channel: {
        propertyId: validated.propertyId,
        channel: validated.channel,
      },
    },
  });

  if (!existing) {
    return { error: "No existe un feed para este canal en esta propiedad" };
  }

  await prisma.propertyExportFeed.update({
    where: { id: existing.id },
    data: { isRevoked: true },
  });

  revalidatePath(`/properties/${validated.propertyId}`);

  return { success: true };
}
