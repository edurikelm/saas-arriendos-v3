"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import {
  loginSchema,
  registerApiSchema,
  forgotPasswordSchema,
  resetPasswordApiSchema,
  type LoginInput,
  type RegisterApiInput,
  type ForgotPasswordInput,
  type ResetPasswordApiInput,
} from "@/lib/validations/auth";
import { SignJWT } from "jose";
import { JWT_SECRET } from "@/lib/auth/jwt-secret";
import { hash, compare } from "bcryptjs";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  isValidPasswordResetTokenFormat,
} from "@/lib/auth/password-reset-tokens";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";

export async function loginAction(data: LoginInput) {
  const validated = loginSchema.parse(data);

  const user = await prisma.userProfile.findUnique({
    where: { email: validated.email },
  });

  if (!user) {
    return { error: "Credenciales inválidas" };
  }

  if (user.status === "SUSPENDED") {
    return { error: "Cuenta suspendida" };
  }

  if (user.status === "CANCELLED") {
    return { error: "Cuenta cancelada" };
  }

  const isValid = await compare(validated.password, user.password);
  if (!isValid) {
    return { error: "Credenciales inválidas" };
  }

  const token = await new SignJWT({
    userId: user.id,
    role: user.role,
    status: user.status,
    plan: user.plan,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return { success: true };
}

export async function registerAction(data: RegisterApiInput) {
  const validated = registerApiSchema.parse(data);

  const existing = await prisma.userProfile.findUnique({
    where: { email: validated.email },
  });

  if (existing) {
    return { error: "Este email ya está registrado" };
  }

  const hashedPassword = await hash(validated.password, 12);

  const user = await prisma.userProfile.create({
    data: {
      email: validated.email,
      password: hashedPassword,
      role: "OWNER",
      plan: "FREE",
    },
  });

  const token = await new SignJWT({
    userId: user.id,
    role: user.role,
    plan: user.plan,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return { success: true };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/login");
}

/**
 * Solicita un reset de contraseña.
 *
 * Anti-enumeración: retorna éxito idéntico tanto si el email existe como si no,
 * y tanto si la cuenta está activa como suspendida/cancelada. Esto evita que
 * un atacante pueda enumerar emails registrados.
 *
 * Si el usuario existe y está ACTIVE:
 *   1. Invalida todos los tokens previos no usados (set expiresAt = now).
 *   2. Genera un nuevo token raw (mostrado 1 vez) + su hash (persistido).
 *   3. Persiste el hash con expiración de 1h.
 *   4. Envía email con el token raw.
 *
 * En dev, si el email no se pudo enviar (Resend no configurado), expone
 * `devResetUrl` para que el equipo de desarrollo pueda probar el flujo.
 */
export async function requestPasswordResetAction(data: ForgotPasswordInput) {
  const validated = forgotPasswordSchema.parse(data);

  const user = await prisma.userProfile.findUnique({
    where: { email: validated.email },
    select: { id: true, email: true, status: true },
  });

  // Anti-enumeración: misma respuesta para email inexistente, SUSPENDED o CANCELLED.
  if (!user || user.status !== "ACTIVE") {
    return { success: true as const };
  }

  // 1) Invalida tokens previos no usados.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { expiresAt: new Date() },
  });

  // 2-3) Genera y persiste el nuevo token.
  const rawToken = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  // 4) Envía email.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

  const emailResult = await sendPasswordResetEmail({
    to: user.email,
    resetUrl,
  });

  if (!emailResult.sent && emailResult.reason === "no-api-key") {
    return { success: true as const, devResetUrl: resetUrl };
  }

  return { success: true as const };
}

export type ValidatePasswordResetTokenResult =
  | { valid: true }
  | { valid: false; reason: "invalid-format" | "not-found" | "used" | "expired" };

/**
 * Valida un token de reset sin consumirlo.
 * Usado por la página /reset-password al cargar para decidir si muestra
 * el formulario o el mensaje de error.
 */
export async function validatePasswordResetTokenAction(
  token: string,
): Promise<ValidatePasswordResetTokenResult> {
  if (!isValidPasswordResetTokenFormat(token)) {
    return { valid: false, reason: "invalid-format" };
  }

  const tokenHash = hashPasswordResetToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, expiresAt: true, usedAt: true },
  });

  if (!record) {
    return { valid: false, reason: "not-found" };
  }
  if (record.usedAt) {
    return { valid: false, reason: "used" };
  }
  if (record.expiresAt < new Date()) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true };
}

export type ResetPasswordResult = { success: true } | { error: string };

/**
 * Aplica el reset de contraseña.
 *
 * Valida el token, lo marca como usado y actualiza el password en una sola
 * transacción. Esto previene race conditions donde dos requests paralelos
 * podrían resetear el password dos veces.
 */
export async function resetPasswordAction(
  data: ResetPasswordApiInput,
): Promise<ResetPasswordResult> {
  const validated = resetPasswordApiSchema.parse(data);

  if (!isValidPasswordResetTokenFormat(validated.token)) {
    return { error: "Token inválido" };
  }

  const tokenHash = hashPasswordResetToken(validated.token);

  return prisma.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return { error: "El enlace de recuperación es inválido o ha expirado" };
    }

    const hashedPassword = await hash(validated.password, 12);

    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    await tx.userProfile.update({
      where: { id: record.userId },
      data: { password: hashedPassword },
    });

    return { success: true };
  });
}
