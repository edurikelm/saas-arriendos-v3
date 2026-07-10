"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  setNotificationsEmailEnabled,
  setNotificationsSmsEnabled,
} from "@/lib/actions/notifications";
import { toast } from "sonner";

type NotificationSettingsProps = {
  initialEmailEnabled: boolean;
  initialSmsEnabled: boolean;
};

export function NotificationSettings({
  initialEmailEnabled,
  initialSmsEnabled,
}: NotificationSettingsProps) {
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled);
  const [smsEnabled, setSmsEnabled] = useState(initialSmsEnabled);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingSms, setIsSavingSms] = useState(false);

  async function handleEmailToggle(checked: boolean) {
    const previousValue = emailEnabled;
    setEmailEnabled(checked);
    setIsSavingEmail(true);

    try {
      const result = await setNotificationsEmailEnabled(checked);
      if ("error" in result) {
        setEmailEnabled(previousValue);
        toast.error(result.error);
      } else {
        toast.success(
          checked
            ? "Notificaciones por email activadas"
            : "Notificaciones por email desactivadas",
        );
      }
    } catch {
      setEmailEnabled(previousValue);
      toast.error("Error al guardar la preferencia");
    } finally {
      setIsSavingEmail(false);
    }
  }

  async function handleSmsToggle(checked: boolean) {
    const previousValue = smsEnabled;
    setSmsEnabled(checked);
    setIsSavingSms(true);

    try {
      const result = await setNotificationsSmsEnabled(checked);
      if ("error" in result) {
        setSmsEnabled(previousValue);
        toast.error(result.error);
      } else {
        toast.success(
          checked
            ? "Notificaciones por SMS activadas"
            : "Notificaciones por SMS desactivadas",
        );
      }
    } catch {
      setSmsEnabled(previousValue);
      toast.error("Error al guardar la preferencia");
    } finally {
      setIsSavingSms(false);
    }
  }

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Notificaciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="notifications-email" className="flex-1 cursor-pointer">
            Alertas por Email
          </Label>
          <Switch
            id="notifications-email"
            checked={emailEnabled}
            onCheckedChange={handleEmailToggle}
            disabled={isSavingEmail}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="notifications-sms" className="flex-1 cursor-pointer">
            Alertas por SMS
          </Label>
          <Switch
            id="notifications-sms"
            checked={smsEnabled}
            onCheckedChange={handleSmsToggle}
            disabled={isSavingSms}
          />
        </div>
      </CardContent>
    </Card>
  );
}
