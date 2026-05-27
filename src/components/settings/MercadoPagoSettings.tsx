"use client";

import { useEffect, useState } from "react";
import { getMercadoPagoIntegration, saveMercadoPagoToken, removeMercadoPagoToken } from "@/lib/actions/mercado-pago";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type MercadoPagoSettingsProps = {
  oauthStatus?: string;
};

function getOauthStatusMessage(status?: string) {
  switch (status) {
    case "connected":
      return { tone: "success", text: "Cuenta conectada correctamente con Mercado Pago." };
    case "config_error":
      return {
        tone: "error",
        text: "Falta configuración OAuth. Revisa NEXT_PUBLIC_APP_URL y MERCADOPAGO_OAUTH_CLIENT_ID.",
      };
    case "invalid_state":
      return { tone: "error", text: "No pudimos validar la conexión OAuth. Intenta conectar nuevamente." };
    case "oauth_error":
      return { tone: "error", text: "Mercado Pago rechazó la autorización. Intenta nuevamente." };
    case "oauth_token_error":
      return { tone: "error", text: "Mercado Pago autorizó la cuenta, pero no pudimos obtener los tokens. Revisa la consola del servidor para ver el detalle de /oauth/token." };
    case "oauth_missing_refresh_token":
      return { tone: "error", text: "Mercado Pago no devolvió refresh_token. Confirma que offline access esté activo y vuelve a conectar." };
    case "missing_params":
      return { tone: "error", text: "Respuesta OAuth incompleta. Intenta nuevamente." };
    case "unauthorized":
      return { tone: "error", text: "Tu sesión expiró. Inicia sesión y vuelve a conectar." };
    default:
      return null;
  }
}

export function MercadoPagoSettings({ oauthStatus }: MercadoPagoSettingsProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [token, setToken] = useState("");
  const [manualTokenEnabled, setManualTokenEnabled] = useState(false);

  useEffect(() => {
    async function loadInitialState() {
      try {
        const result = await getMercadoPagoIntegration();
        if (result) {
          setIsConnected(result.isConnected);
          setManualTokenEnabled(result.manualTokenEnabled);
        }
      } catch (error) {
        console.error("[MP Settings] Error loading initial state:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialState();
  }, []);

  async function handleConnect() {
    if (!manualTokenEnabled) {
      setIsConnecting(true);
      window.location.href = "/api/integrations/mercadopago/oauth/start";
      return;
    }

    if (!token.trim()) {
      toast.error("Por favor ingresa un token de Mercado Pago");
      return;
    }

    setIsConnecting(true);
    try {
      const result = await saveMercadoPagoToken(token);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cuenta de Mercado Pago conectada exitosamente");
        setToken("");
        setIsConnected(true);
      }
    } catch (error) {
      console.error("[MP Settings] Error connecting:", error);
      toast.error("Error al conectar con Mercado Pago");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      const result = await removeMercadoPagoToken();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Cuenta de Mercado Pago desconectada");
        setIsConnected(false);
      }
    } catch (error) {
      console.error("[MP Settings] Error disconnecting:", error);
      toast.error("Error al desconectar de Mercado Pago");
    } finally {
      setIsDisconnecting(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </CardContent>
      </Card>
    );
  }

  const oauthMessage = getOauthStatusMessage(oauthStatus);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mercado Pago</CardTitle>
        <CardDescription>Gestiona la conexión con tu cuenta de Mercado Pago</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {oauthMessage ? (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              oauthMessage.tone === "success"
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
          >
            {oauthMessage.text}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isConnected ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
            }`}
          >
            {isConnected ? "Conectado" : "No conectado"}
          </span>
        </div>

        {isConnected ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tu cuenta de Mercado Pago está conectada
            </p>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? "Desconectando..." : "Desconectar"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {manualTokenEnabled ? (
              <div className="space-y-2">
                <Label htmlFor="mp-token">Access Token</Label>
                <Input
                  id="mp-token"
                  type="password"
                  placeholder="APP_USR-xxxxxxxx-xxxxxxxx-..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Conecta tu cuenta con OAuth para habilitar cobros en Mercado Pago.
              </p>
            )}
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? "Conectando..." : manualTokenEnabled ? "Conectar" : "Conectar con Mercado Pago"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
