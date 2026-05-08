"use server";

import { prisma } from "@/lib/db/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { getSession } from "./auth";
import { IntegrationProvider } from "@prisma/client";

const MP_API_BASE = "https://api.mercadopago.com";

export async function validateMercadoPagoToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${MP_API_BASE}/users/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function saveMercadoPagoToken(token: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Usuario no autenticado" };
    }

    const isValid = await validateMercadoPagoToken(token);
    if (!isValid) {
      return { error: "Token de Mercado Pago inválido" };
    }

    const encryptedToken = encrypt(token, process.env.ENCRYPTION_KEY!);

    await prisma.userIntegration.upsert({
      where: {
        userId_provider: {
          userId: session.userId,
          provider: IntegrationProvider.MERCADO_PAGO,
        },
      },
      update: {
        accessToken: encryptedToken,
        isActive: true,
      },
      create: {
        userId: session.userId,
        provider: IntegrationProvider.MERCADO_PAGO,
        accessToken: encryptedToken,
        isActive: true,
      },
    });

    console.log(`[MP Integration] Mercado Pago token saved for user ${session.userId}`);
    return { success: true };
  } catch (error) {
    console.error("[MP Integration] Error saving Mercado Pago token:", error);
    return { error: "Error al guardar el token de Mercado Pago" };
  }
}

export async function getMercadoPagoIntegration(): Promise<{ isConnected: boolean; hasToken: boolean } | null> {
  try {
    const session = await getSession();
    if (!session) {
      return null;
    }

    const integration = await prisma.userIntegration.findUnique({
      where: {
        userId_provider: {
          userId: session.userId,
          provider: IntegrationProvider.MERCADO_PAGO,
        },
      },
    });

    return {
      isConnected: integration?.isActive ?? false,
      hasToken: !!integration?.accessToken,
    };
  } catch (error) {
    console.error("[MP Integration] Error getting Mercado Pago integration:", error);
    return null;
  }
}

export async function removeMercadoPagoToken(): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Usuario no autenticado" };
    }

    await prisma.userIntegration.updateMany({
      where: {
        userId: session.userId,
        provider: IntegrationProvider.MERCADO_PAGO,
      },
      data: {
        isActive: false,
      },
    });

    console.log(`[MP Integration] Mercado Pago token disconnected for user ${session.userId}`);
    return { success: true };
  } catch (error) {
    console.error("[MP Integration] Error removing Mercado Pago token:", error);
    return { error: "Error al eliminar el token de Mercado Pago" };
  }
}

export async function getMercadoPagoToken(userId: string): Promise<string | null> {
  try {
    const integration = await prisma.userIntegration.findFirst({
      where: {
        userId,
        provider: IntegrationProvider.MERCADO_PAGO,
        isActive: true,
      },
    });

    if (!integration?.accessToken) {
      return null;
    }

    const decryptedToken = decrypt(integration.accessToken, process.env.ENCRYPTION_KEY!);
    console.log(`[MP Integration] Retrieved Mercado Pago token for user ${userId}`);
    return decryptedToken;
  } catch (error) {
    console.error("[MP Integration] Error retrieving Mercado Pago token:", error);
    return null;
  }
}
