import { MercadoPagoSettings } from "@/components/settings/MercadoPagoSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ProfileForm } from "@/components/settings/profile-form";
import {
  getNotificationsEmailEnabled,
  getNotificationsSmsEnabled,
} from "@/lib/actions/notifications";
import { getUserProfileSettings } from "@/lib/actions/profile";

type SettingsPageProps = {
  searchParams: Promise<{
    mp?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const [profile, emailEnabled, smsEnabled] = await Promise.all([
    getUserProfileSettings(),
    getNotificationsEmailEnabled(),
    getNotificationsSmsEnabled(),
  ]);

  // (dashboard)/layout.tsx already enforces requireOwner(), so session is guaranteed.
  // If profile is null here, it means the session userId has no UserProfile row (data inconsistency).
  if (!profile) {
    throw new Error("Perfil de usuario no encontrado");
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Administra tu perfil, empresa y preferencias de la plataforma
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <ProfileForm initialData={profile} />

        <div className="space-y-6">
          <NotificationSettings
            initialEmailEnabled={emailEnabled}
            initialSmsEnabled={smsEnabled}
          />
          <MercadoPagoSettings oauthStatus={params.mp} />
        </div>
      </div>
    </div>
  );
}