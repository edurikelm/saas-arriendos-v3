"use client";

import { useEffect, useState } from "react";
import { getMercadoPagoIntegration, saveMercadoPagoToken, removeMercadoPagoToken } from "@/lib/actions/mercado-pago";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function MercadoPagoSettings() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    async function loadInitialState() {
      try {
        const result = await getMercadoPagoIntegration();
        if (result) {
          setIsConnected(result.isConnected);
          console.log("[MP Settings] Initial state loaded - isConnected:", result.isConnected);
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
        console.log("[MP Settings] Successfully connected");
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
        console.log("[MP Settings] Successfully disconnected");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mercado Pago</CardTitle>
        <CardDescription>Gestiona la conexión con tu cuenta de Mercado Pago</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? "Conectando..." : "Conectar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
