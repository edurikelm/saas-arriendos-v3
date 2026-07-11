"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { loginSchema, registerApiSchema, type LoginInput, type RegisterApiInput } from "@/lib/validations/auth";
import { SignJWT } from "jose";
import { JWT_SECRET } from "@/lib/auth/jwt-secret";
import { hash, compare } from "bcryptjs";

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
