import type { Metadata } from "next";
import Link from "next/link";
import { validatePasswordResetTokenAction } from "@/lib/actions/auth";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "RentalPro - Restablecer contraseña",
  description: "Crea una nueva contraseña para tu cuenta de RentalPro",
};

type SearchParams = Promise<{ token?: string | string[] }>;

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  "invalid-format": {
    title: "Enlace inválido",
    description: "El enlace de recuperación no tiene un formato válido. Solicita uno nuevo.",
  },
  "not-found": {
    title: "Enlace no encontrado",
    description: "No encontramos este enlace de recuperación. Es posible que ya haya sido utilizado o que haya expirado.",
  },
  used: {
    title: "Enlace ya utilizado",
    description: "Este enlace ya fue usado para restablecer una contraseña. Si necesitas cambiar tu contraseña nuevamente, solicita otro enlace.",
  },
  expired: {
    title: "Enlace expirado",
    description: "Este enlace expiró. Los enlaces de recuperación tienen una validez de 1 hora.",
  },
  missing: {
    title: "Falta el token",
    description: "El enlace no incluye un token de recuperación válido.",
  },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = typeof rawToken === "string" ? rawToken : undefined;

  if (!token) {
    const message = ERROR_MESSAGES.missing;
    return (
      <Card className="w-full max-w-sm mx-4">
        <CardHeader>
          <CardTitle>{message.title}</CardTitle>
          <CardDescription>{message.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/forgot-password"
            className={buttonVariants({ variant: "default", className: "w-full" })}
          >
            Solicitar nuevo enlace
          </Link>
        </CardContent>
      </Card>
    );
  }

  const validation = await validatePasswordResetTokenAction(token);

  if (!validation.valid) {
    const message = ERROR_MESSAGES[validation.reason] ?? ERROR_MESSAGES["not-found"];
    return (
      <Card className="w-full max-w-sm mx-4">
        <CardHeader>
          <CardTitle>{message.title}</CardTitle>
          <CardDescription>{message.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/forgot-password"
            className={buttonVariants({ variant: "default", className: "w-full" })}
          >
            Solicitar nuevo enlace
          </Link>
        </CardContent>
      </Card>
    );
  }

  return <ResetPasswordForm token={token} />;
}
