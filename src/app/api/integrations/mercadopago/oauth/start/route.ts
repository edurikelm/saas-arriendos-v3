import { createHash, randomBytes, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { IntegrationProvider } from "@prisma/client";
import { getSession } from "@/lib/actions/auth";
import { prisma } from "@/lib/db/prisma";

const MP_AUTH_BASE = "https://auth.mercadopago.com";

function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createPkcePair() {
  const verifier = base64Url(randomBytes(64));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());

  return { verifier, challenge };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const clientId = process.env.MERCADOPAGO_OAUTH_CLIENT_ID || process.env.MERCADOPAGO_CLIENT_ID;
  if (!appUrl || !clientId) {
    return NextResponse.redirect(new URL("/settings?mp=config_error", appUrl ?? "http://localhost:3000"));
  }

  const state = randomUUID();
  const pkce = createPkcePair();

  const current = await prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId: session.userId,
        provider: IntegrationProvider.MERCADO_PAGO,
      },
    },
  });

  await prisma.userIntegration.upsert({
    where: {
      userId_provider: {
        userId: session.userId,
        provider: IntegrationProvider.MERCADO_PAGO,
      },
    },
    update: {
      metadata: {
        ...((current?.metadata as Record<string, unknown> | null) ?? {}),
        oauthState: state,
        oauthCodeVerifier: pkce.verifier,
      },
    },
    create: {
      userId: session.userId,
      provider: IntegrationProvider.MERCADO_PAGO,
      accessToken: "",
      isActive: false,
      metadata: {
        oauthState: state,
        oauthCodeVerifier: pkce.verifier,
      },
    },
  });

  const redirectUri = `${appUrl}/api/integrations/mercadopago/oauth/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: redirectUri,
    scope: "offline_access",
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
  });

  return NextResponse.redirect(`${MP_AUTH_BASE}/authorization?${params.toString()}`);
}
