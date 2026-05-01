"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { loginSchema, registerSchema, registerApiSchema, type LoginInput, type RegisterInput, type RegisterApiInput } from "@/lib/validations/auth";
import { SignJWT, jwtVerify } from "jose";
import { hash, compare } from "bcryptjs";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key");

export async function loginAction(data: LoginInput) {
  const validated = loginSchema.parse(data);

  const user = await prisma.userProfile.findUnique({
    where: { email: validated.email },
  });

  if (!user) {
    return { error: "Credenciales inválidas" };
  }

  const isValid = await compare(validated.password, user.password);
  if (!isValid) {
    return { error: "Credenciales inválidas" };
  }

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

export type SessionUser = {
  userId: string;
  role: string;
  plan: string | null;
  email: string;
};

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }
  return session;
}