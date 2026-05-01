"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";

export async function getMercadoPagoIntegration() {
  const session = await getSession();
  if (!session) return null;

  const integration = await prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId: session.userId,
        provider: "MERCADO_PAGO" as const,
      },
    },
  });

  if (!integration) return null;

  return {
    isConnected: integration.isActive,
    hasToken: !!integration.accessToken,
    createdAt: integration.createdAt.toISOString(),
  };
}

export async function saveMercadoPagoToken(token: string) {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  if (!token || token.trim().length === 0) {
    return { error: "El token es requerido" };
  }

  try {
    const response = await fetch("https://api.mercadopago.com/users/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { error: "Token inválido o expirado" };
      }
      return { error: "Error al validar el token" };
    }

    const userData = await response.json();

    await prisma.userIntegration.upsert({
      where: {
        userId_provider: {
          userId: session.userId,
          provider: "MERCADO_PAGO" as const,
        },
      },
      update: {
        accessToken: token.trim(),
        isActive: true,
        metadata: userData as any,
      },
      create: {
        userId: session.userId,
        provider: "MERCADO_PAGO" as const,
        accessToken: token.trim(),
        isActive: true,
        metadata: userData as any,
      },
    });

    return { success: true };
  } catch {
    return { error: "Error de conexión con Mercado Pago" };
  }
}

export async function disconnectMercadoPago() {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  await prisma.userIntegration.updateMany({
    where: {
      userId: session.userId,
      provider: "MERCADO_PAGO",
    },
    data: {
      isActive: false,
    },
  });

  return { success: true };
}