"use server";

import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";
import { uploadImage } from "@/lib/actions/cloudinary";
import { profileSchema, type ProfileInput } from "@/lib/validations/profile";

export type ProfileData = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  companyName: string | null;
  companyRut: string | null;
  companyAddress: string | null;
  language: string;
  currency: string;
  timezone: string;
  avatarUrl: string | null;
  notificationsEmailEnabled: boolean;
  notificationsSmsEnabled: boolean;
};

export async function getUserProfileSettings(): Promise<ProfileData | null> {
  const session = await getSession();
  if (!session) return null;

  const profile = await prisma.userProfile.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      companyName: true,
      companyRut: true,
      companyAddress: true,
      language: true,
      currency: true,
      timezone: true,
      avatarUrl: true,
      notificationsEmailEnabled: true,
      notificationsSmsEnabled: true,
    },
  });

  return profile;
}

export async function updateUserProfile(
  input: ProfileInput,
): Promise<{ success: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const validated = profileSchema.parse(input);

  await prisma.userProfile.update({
    where: { id: session.userId },
    data: {
      name: validated.name,
      phone: validated.phone ?? null,
      companyName: validated.companyName ?? null,
      companyRut: validated.companyRut ?? null,
      companyAddress: validated.companyAddress ?? null,
      language: validated.language,
      currency: validated.currency,
      timezone: validated.timezone,
    },
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function uploadAvatar(
  formData: FormData,
): Promise<{ success: true; url: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "No autorizado" };

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { error: "Archivo no proporcionado" };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "Solo se permiten archivos de imagen" };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "El archivo debe ser menor a 5MB" };
  }

  const url = await uploadImage(file, "rentalpro/avatars");

  await prisma.userProfile.update({
    where: { id: session.userId },
    data: { avatarUrl: url },
  });

  revalidatePath("/settings");
  return { success: true, url };
}
