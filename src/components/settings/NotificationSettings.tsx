"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setNotificationsEmailEnabled } from "@/lib/actions/notifications";
import { toast } from "sonner";

type NotificationSettingsProps = {
  initialEnabled: boolean;
};

export function NotificationSettings({ initialEnabled }: NotificationSettingsProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggle(checked: boolean) {
    const previousValue = enabled;
    setEnabled(checked);
    setIsSaving(true);

    try {
      const result = await setNotificationsEmailEnabled(checked);
      if ("error" in result) {
        setEnabled(previousValue);
        toast.error(result.error);
      } else {
        toast.success(
          checked
            ? "Notificaciones por email activadas"
            : "Notificaciones por email desactivadas",
        );
      }
    } catch {
      setEnabled(previousValue);
      toast.error("Error al guardar la preferencia");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificaciones</CardTitle>
        <CardDescription>Gestiona cómo recibes los avisos del sistema</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <Label htmlFor="notifications-email" className="flex-1 cursor-pointer">
          Recibir recordatorios de pago y avisos por email. Las notificaciones en la app
          siguen activas.
        </Label>
        <Switch
          id="notifications-email"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={isSaving}
        />
      </CardContent>
    </Card>
  );
}
