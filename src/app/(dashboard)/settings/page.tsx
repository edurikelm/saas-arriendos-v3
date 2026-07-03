import { MercadoPagoSettings } from "@/components/settings/MercadoPagoSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { getNotificationsEmailEnabled } from "@/lib/actions/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SettingsPageProps = {
  searchParams: Promise<{
    mp?: string;
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const emailNotificationsEnabled = await getNotificationsEmailEnabled();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configuración</h1>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Notificaciones</h2>
        <NotificationSettings initialEnabled={emailNotificationsEnabled} />
      </div>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Integraciones</h2>
        <Card>
          <CardHeader>
            <CardTitle>Mercado Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <MercadoPagoSettings oauthStatus={params.mp} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
