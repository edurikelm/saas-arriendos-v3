import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "RentalPro - Recuperar contraseña",
  description: "Recupera el acceso a tu cuenta de RentalPro",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
