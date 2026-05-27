"use server";

import { prisma } from "@/lib/db/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { getSession } from "./auth";
import { IntegrationProvider, Prisma } from "@prisma/client";

const MP_API_BASE = "https://api.mercadopago.com";
const MP_AUTH_BASE = "https://auth.mercadopago.com";

type MercadoPagoMetadata = {
  oauthState?: string;
  refreshTokenEncrypted?: string;
  expiresAt?: string;
  connectedAt?: string;
  account?: {
    userId?: number;
    publicKey?: string;
    nickname?: string;
  };
};

function isManualTokenEnabled() {
  return process.env.MP_MANUAL_TOKEN_ENABLED === "true";
}

function isMercadoPagoSandboxMode() {
  return process.env.MERCADOPAGO_SANDBOX_MODE === "true" || process.env.MERCADOPAGO_OAUTH_TEST_TOKEN === "true";
}

function getEncryptionKey() {
  return process.env.ENCRYPTION_KEY!;
}

function getOAuthClientId() {
  return process.env.MERCADOPAGO_OAUTH_CLIENT_ID || process.env.MERCADOPAGO_CLIENT_ID || null;
}

function getOAuthClientSecret() {
  return process.env.MERCADOPAGO_OAUTH_CLIENT_SECRET || process.env.MERCADOPAGO_CLIENT_SECRET || null;
}

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
    if (!isManualTokenEnabled()) {
      return { error: "La carga manual de token está deshabilitada" };
    }

    const session = await getSession();
    if (!session) {
      return { error: "Usuario no autenticado" };
    }

    const isValid = await validateMercadoPagoToken(token);
    if (!isValid) {
      return { error: "Token de Mercado Pago inválido" };
    }

    const encryptedToken = encrypt(token, getEncryptionKey());

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
          metadata: {
            connectedAt: new Date().toISOString(),
          },
        },
        create: {
          userId: session.userId,
          provider: IntegrationProvider.MERCADO_PAGO,
          accessToken: encryptedToken,
          isActive: true,
          metadata: {
            connectedAt: new Date().toISOString(),
          },
        },
      });
    return { success: true };
  } catch (error) {
    console.error("[MP Integration] Error saving Mercado Pago token:", error);
    return { error: "Error al guardar el token de Mercado Pago" };
  }
}

export async function getMercadoPagoIntegration(): Promise<{ isConnected: boolean; hasToken: boolean; manualTokenEnabled: boolean; sandboxMode: boolean } | null> {
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
      manualTokenEnabled: isManualTokenEnabled(),
      sandboxMode: isMercadoPagoSandboxMode(),
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
        accessToken: "",
        metadata: Prisma.JsonNull,
      },
    });
    return { success: true };
  } catch (error) {
    console.error("[MP Integration] Error removing Mercado Pago token:", error);
    return { error: "Error al eliminar el token de Mercado Pago" };
  }
}

export async function getMercadoPagoToken(userId: string): Promise<string | null> {
  return getValidMercadoPagoToken(userId);
}

export async function getValidMercadoPagoToken(userId: string): Promise<string | null> {
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

    const metadata = (integration.metadata ?? {}) as MercadoPagoMetadata;
    const now = Date.now();
    const expiresAt = metadata.expiresAt ? new Date(metadata.expiresAt).getTime() : null;

    if (!expiresAt || expiresAt - 30_000 > now) {
      return decrypt(integration.accessToken, getEncryptionKey());
    }

    const refreshTokenEncrypted = metadata.refreshTokenEncrypted;
    if (!refreshTokenEncrypted) {
      await prisma.userIntegration.update({
        where: { id: integration.id },
        data: { isActive: false },
      });
      return null;
    }

    const refreshToken = decrypt(refreshTokenEncrypted, getEncryptionKey());
    const refreshed = await refreshMercadoPagoToken(refreshToken);
    if (!refreshed) {
      await prisma.userIntegration.update({
        where: { id: integration.id },
        data: { isActive: false },
      });
      return null;
    }

    const encryptedAccessToken = encrypt(refreshed.accessToken, getEncryptionKey());
    const encryptedRefreshToken = encrypt(refreshed.refreshToken, getEncryptionKey());

    await prisma.userIntegration.update({
      where: { id: integration.id },
      data: {
        accessToken: encryptedAccessToken,
        metadata: {
          ...metadata,
          refreshTokenEncrypted: encryptedRefreshToken,
          expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
        },
      },
    });

    return refreshed.accessToken;
  } catch (error) {
    console.error("[MP Integration] Error retrieving Mercado Pago token:", error);
    return null;
  }
}

async function refreshMercadoPagoToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  try {
    const clientId = getOAuthClientId();
    const clientSecret = getOAuthClientSecret();

    if (!clientId) {
      return null;
    }

    const tokenBody: Record<string, string> = {
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    };

    if (clientSecret) {
      tokenBody.client_secret = clientSecret;
    }

    const response = await fetch(`${MP_API_BASE}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tokenBody),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data?.access_token || !data?.refresh_token || typeof data?.expires_in !== "number") {
      return null;
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error("[MP Integration] Error refreshing Mercado Pago token:", error);
    return null;
  }
}

export async function getMercadoPagoOAuthStartUrl(): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const clientId = getOAuthClientId();

  if (!appUrl || !clientId) {
    return null;
  }

  const redirectUri = `${appUrl}/api/integrations/mercadopago/oauth/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: redirectUri,
  });

  return `${MP_AUTH_BASE}/authorization?${params.toString()}`;
}
