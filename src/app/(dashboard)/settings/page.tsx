"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMercadoPagoIntegration, saveMercadoPagoToken, disconnectMercadoPago } from "@/lib/actions/mercado-pago";

function MercadoPagoStatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        connected
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          connected ? "bg-emerald-500" : "bg-muted-foreground/50"
        }`}
      />
      {connected ? "Conectado" : "No conectado"}
    </span>
  );
}

function MercadoPagoSettings() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    loadIntegrationStatus();
  }, []);

  async function loadIntegrationStatus() {
    try {
      const data = await getMercadoPagoIntegration();
      setIsConnected(data?.isConnected ?? false);
    } catch {
      toast.error("Error al cargar estado de integración");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConnect() {
    if (!token.trim()) {
      toast.error("Ingresa un token de acceso");
      return;
    }

    setIsConnecting(true);
    try {
      const result = await saveMercadoPagoToken(token);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Mercado Pago conectado correctamente");
        setToken("");
        setIsConnected(true);
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      const result = await disconnectMercadoPago();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Mercado Pago desconectado");
        setIsConnected(false);
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsDisconnecting(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#00B1EA]/10">
              <svg
                className="size-5 text-[#00B1EA]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
            <div>
              <CardTitle>Mercado Pago</CardTitle>
              <CardDescription>
                Integrate Mercado Pago for payment collection
              </CardDescription>
            </div>
          </div>
          <MercadoPagoStatusBadge connected={isConnected} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your Mercado Pago account is connected. You can disconnect it below.
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
            <p className="text-sm text-muted-foreground">
              Enter your Mercado Pago access token to enable payment collection.
            </p>
            <div className="space-y-2">
              <Label htmlFor="mp-token">Access Token</Label>
              <Input
                id="mp-token"
                type="password"
                placeholder="APP_USR-xxxxxxxx-xxxxxxxx-..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isConnecting}
              />
            </div>
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? "Conectando..." : "Conectar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and integrations
        </p>
      </div>

      <div className="space-y-6">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Integraciones</h2>
          <MercadoPagoSettings />
        </section>
      </div>
    </div>
  );
}