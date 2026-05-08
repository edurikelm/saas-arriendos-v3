import { MercadoPagoSettings } from "@/components/settings/MercadoPagoSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configuración</h1>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Integraciones</h2>
        <Card>
          <CardHeader>
            <CardTitle>Mercado Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <MercadoPagoSettings />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}