import type { Metadata } from "next";
import { PricingPage } from "@/components/pricing/pricing-page";

export const metadata: Metadata = {
  title: "RentalPro - Planes y precios",
  description:
    "Elige el plan que se ajusta a tu operación. Empieza gratis con hasta 3 propiedades y 5 clientes. Actualiza a PRO para propiedades ilimitadas, sincronización iCal y documentos de reserva.",
};

export default function PricingRoute() {
  return <PricingPage />;
}
