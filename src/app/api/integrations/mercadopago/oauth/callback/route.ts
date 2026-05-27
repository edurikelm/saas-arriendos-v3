import { NextResponse } from "next/server";
import { IntegrationProvider } from "@prisma/client";
import { getSession } from "@/lib/actions/auth";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db/prisma";

const MP_API_BASE = "https://api.mercadopago.com";

function settingsRedirect(status: string) {
  return NextResponse.redirect(new URL(`/settings?mp=${status}`, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
}

function getSafeTokenExchangeContext(params: {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  codeVerifier: string;
  testToken: string;
}) {
  return {
    clientIdTail: params.clientId.slice(-6),
    hasClientSecret: Boolean(params.clientSecret),
    redirectUri: params.redirectUri,
    codeVerifierLength: params.codeVerifier.length,
    testToken: params.testToken,
  };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return settingsRedirect("unauthorized");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return settingsRedirect("missing_params");
  }

  const integration = await prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId: session.userId,
        provider: IntegrationProvider.MERCADO_PAGO,
      },
    },
  });

  const metadata = (integration?.metadata ?? {}) as Record<string, unknown>;
  if (metadata.oauthState !== state) {
    return settingsRedirect("invalid_state");
  }

  const codeVerifier = typeof metadata.oauthCodeVerifier === "string" ? metadata.oauthCodeVerifier : null;
  if (!codeVerifier) {
    return settingsRedirect("invalid_state");
  }

  const clientId = process.env.MERCADOPAGO_OAUTH_CLIENT_ID || process.env.MERCADOPAGO_CLIENT_ID;
  const clientSecret = process.env.MERCADOPAGO_OAUTH_CLIENT_SECRET || process.env.MERCADOPAGO_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!clientId || !appUrl || !encryptionKey) {
    return settingsRedirect("config_error");
  }

  const redirectUri = `${appUrl}/api/integrations/mercadopago/oauth/callback`;
  const testToken = process.env.MERCADOPAGO_OAUTH_TEST_TOKEN === "true" ? "true" : "false";
  const tokenBody: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    test_token: testToken,
  };

  if (clientSecret) {
    tokenBody.client_secret = clientSecret;
  }

  const tokenResponse = await fetch(`${MP_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tokenBody),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text().catch(() => "");
    console.error("[MP OAuth] Token exchange failed", {
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      body: errorText,
      context: getSafeTokenExchangeContext({
        clientId,
        clientSecret,
        redirectUri,
        codeVerifier,
        testToken,
      }),
    });
    return settingsRedirect("oauth_token_error");
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData?.access_token || typeof tokenData?.expires_in !== "number") {
    console.error("[MP OAuth] Token response missing access token or expiry", {
      keys: Object.keys(tokenData ?? {}),
    });
    return settingsRedirect("oauth_token_error");
  }

  const isTestTokenMode = process.env.MERCADOPAGO_OAUTH_TEST_TOKEN === "true";

  if (!tokenData?.refresh_token && !isTestTokenMode) {
    console.error("[MP OAuth] Token response missing refresh_token. Check offline_access scope and app permissions.", {
      keys: Object.keys(tokenData ?? {}),
    });
    return settingsRedirect("oauth_missing_refresh_token");
  }

  let nickname: string | undefined;
  if (tokenData.access_token) {
    const accountResponse = await fetch(`${MP_API_BASE}/users/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    if (accountResponse.ok) {
      const account = await accountResponse.json();
      nickname = account?.nickname;
    }
  }

  const integrationMetadata = {
    connectedAt: new Date().toISOString(),
    ...(tokenData.refresh_token
      ? { refreshTokenEncrypted: encrypt(tokenData.refresh_token, encryptionKey) }
      : {}),
    expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    mode: isTestTokenMode ? "test" : "production",
    account: {
      userId: tokenData.user_id,
      publicKey: tokenData.public_key,
      nickname,
    },
  };

  await prisma.userIntegration.upsert({
    where: {
      userId_provider: {
        userId: session.userId,
        provider: IntegrationProvider.MERCADO_PAGO,
      },
    },
    update: {
      accessToken: encrypt(tokenData.access_token, encryptionKey),
      isActive: true,
      metadata: integrationMetadata,
    },
    create: {
      userId: session.userId,
      provider: IntegrationProvider.MERCADO_PAGO,
      accessToken: encrypt(tokenData.access_token, encryptionKey),
      isActive: true,
      metadata: integrationMetadata,
    },
  });

  return settingsRedirect("connected");
}
