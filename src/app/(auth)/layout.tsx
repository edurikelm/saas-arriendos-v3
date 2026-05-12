import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RentalPro - Iniciar sesión o registrarse",
  description: "Accede a tu cuenta o crea una nueva en RentalPro",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      {children}
    </div>
  );
}