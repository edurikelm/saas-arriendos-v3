import { Check, X, Sparkles, MessageCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * TODO Operativo: actualizar el canal de contacto para upgrade a PRO.
 * Hoy el upgrade es manual (super-admin ejecuta `updateUserPlan`), no hay Stripe.
 * Reemplazar `WHATSAPP_URL` y `SUPPORT_EMAIL` con los valores reales antes de publicar.
 */
const WHATSAPP_URL = "https://wa.me/56999999999?text=Hola%2C%20quiero%20el%20plan%20PRO%20de%20RentalPro";
const SUPPORT_EMAIL = "soporte@rentalpro.cl";

const PLAN_FEATURES = {
  free: {
    name: "FREE",
    tagline: "Para propietarios que están partiendo",
    price: "$0",
    priceSuffix: "siempre",
    cta: { label: "Empieza gratis", href: "/register" },
    highlights: [
      "3 propiedades",
      "5 clientes",
      "Calendario timeline",
      "MercadoPago integrado",
      "Soporte por tickets",
    ],
  },
  pro: {
    name: "PRO",
    tagline: "Para administradores con varias propiedades",
    price: "Consulta",
    priceSuffix: "precio según volumen",
    cta: { label: "Hablar con ventas", href: WHATSAPP_URL, external: true },
    highlights: [
      "Propiedades ilimitadas",
      "Clientes ilimitados",
      "Sincronización iCal (Airbnb, Booking, VRBO)",
      "Documentos de reserva (contratos, anexos)",
      "Reportes con rango completo",
      "Soporte prioritario",
    ],
  },
} as const;

const COMPARISON: Array<{
  category: string;
  rows: Array<{ feature: string; free: string | boolean; pro: string | boolean }>;
}> = [
  {
    category: "Gestión de propiedades",
    rows: [
      { feature: "Propiedades", free: "3", pro: "Ilimitadas" },
      { feature: "Clientes", free: "5", pro: "Ilimitados" },
      { feature: "Reservas y calendario", free: "Ilimitadas", pro: "Ilimitadas" },
    ],
  },
  {
    category: "Integraciones",
    rows: [
      { feature: "MercadoPago (cobros automáticos)", free: true, pro: true },
      { feature: "Sincronización iCal (Airbnb, Booking, VRBO)", free: false, pro: true },
      { feature: "Exportar feed iCal hacia canales externos", free: false, pro: true },
    ],
  },
  {
    category: "Operación diaria",
    rows: [
      { feature: "Calendario timeline multi-propiedad", free: true, pro: true },
      { feature: "Reportes de cobranza", free: true, pro: true },
      { feature: "Reportes con rango de fechas completo", free: false, pro: true },
      { feature: "Documentos de reserva (contratos, anexos)", free: false, pro: true },
    ],
  },
  {
    category: "Comunicación",
    rows: [
      { feature: "Notificaciones in-app + email", free: true, pro: true },
      { feature: "Recordatorios automáticos de pago", free: true, pro: true },
      { feature: "Soporte por tickets", free: true, pro: true },
      { feature: "Soporte prioritario", free: false, pro: true },
    ],
  },
];

function Cell({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Check className="size-4" strokeWidth={3} />
      </span>
    ) : (
      <span className="inline-flex size-6 items-center justify-center text-muted-foreground/40">
        <X className="size-4" />
      </span>
    );
  }
  return <span className="text-sm font-medium">{value}</span>;
}

function PlanCard({
  plan,
  featured,
}: {
  plan: (typeof PLAN_FEATURES)[keyof typeof PLAN_FEATURES];
  featured: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-[2rem] p-8 md:p-10 flex flex-col",
        featured
          ? "bg-primary text-white shadow-2xl shadow-primary/30 md:scale-105 md:-my-4"
          : "bg-white border border-black/5 shadow-sm",
      )}
    >
      {featured && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary shadow-lg">
          <Sparkles className="size-3" /> Recomendado
        </div>
      )}

      <div>
        <h3
          className={cn(
            "text-2xl font-bold tracking-tight",
            featured ? "text-white" : "text-foreground",
          )}
        >
          {plan.name}
        </h3>
        <p
          className={cn(
            "mt-2 text-sm leading-relaxed",
            featured ? "text-white/80" : "text-muted-foreground",
          )}
        >
          {plan.tagline}
        </p>
      </div>

      <div className="mt-8 flex items-baseline gap-2">
        <span
          className={cn(
            "text-5xl font-black tracking-tight",
            featured ? "text-white" : "text-foreground",
          )}
        >
          {plan.price}
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            featured ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {plan.priceSuffix}
        </span>
      </div>

      <Link
        href={plan.cta.href}
        target={("external" in plan.cta && plan.cta.external) ? "_blank" : undefined}
        rel={("external" in plan.cta && plan.cta.external) ? "noopener noreferrer" : undefined}
        className={cn(
          "mt-8 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold transition-all w-full",
          featured
            ? "bg-white text-primary hover:scale-105 shadow-lg"
            : "bg-foreground text-background hover:bg-foreground/90",
        )}
      >
        {plan.cta.label}
        <ArrowRight className="size-4" />
      </Link>

      <ul className="mt-10 space-y-4">
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-3 text-sm">
            <span
              className={cn(
                "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                featured ? "bg-white/20" : "bg-primary/10",
              )}
            >
              <Check
                className={cn("size-3", featured ? "text-white" : "text-primary")}
                strokeWidth={3}
              />
            </span>
            <span className={cn(featured ? "text-white" : "text-foreground")}>{h}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass border-b border-black/5 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
              <span className="text-white font-bold text-xl">R</span>
            </div>
            <span className="font-bold text-2xl tracking-tight text-foreground">RentalPro</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link href="/#features" className="hover:text-primary transition-colors">Características</Link>
            <Link href="/pricing" className="text-primary font-bold">Precios</Link>
            <Link href="/#mercadopago" className="hover:text-primary transition-colors">Mercado Pago</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-sm font-semibold hover:text-primary transition-colors px-4 py-2")}>
              Entrar
            </Link>
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold shadow-lg shadow-primary/20 hover:scale-105 transition-transform border-none hover:bg-primary/90",
              )}
            >
              Empieza Gratis
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="pt-40 pb-16 px-6 relative overflow-hidden">
          <div className="absolute -top-20 right-0 size-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 left-0 size-96 bg-brand-secondary/10 rounded-full blur-3xl" />

          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-secondary/10 text-brand-secondary text-xs font-bold mb-6 border border-brand-secondary/20 uppercase tracking-wider">
              <Sparkles className="size-3" /> Planes y precios
            </div>
            <h1 className="text-5xl md:text-6xl font-bold leading-[1.05] mb-6 text-foreground tracking-tight">
              Empieza gratis. <span className="text-primary">Crece sin límites</span>.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Elige el plan que se ajusta a tu operación. Sin tarjetas, sin compromisos, cancela cuando quieras.
            </p>
          </div>
        </section>

        {/* Pricing cards */}
        <section className="px-6 pb-24">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6 md:gap-8 items-stretch">
            <PlanCard plan={PLAN_FEATURES.free} featured={false} />
            <PlanCard plan={PLAN_FEATURES.pro} featured={true} />
          </div>

          <p className="max-w-3xl mx-auto text-center text-sm text-muted-foreground mt-12">
            ¿Tienes una operación grande o necesitas facturación? Escríbenos a{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-primary font-medium hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        {/* Comparación detallada */}
        <section id="comparativa" className="py-24 px-6 bg-beige">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground tracking-tight">
                Compara los planes en detalle
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
                Todo lo que necesitas saber sobre qué incluye cada plan.
              </p>
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm border border-black/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-1/2">
                        Función
                      </th>
                      <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center w-1/4">
                        FREE
                      </th>
                      <th className="px-6 py-5 text-[10px] font-bold uppercase tracking-wider text-primary text-center w-1/4">
                        PRO
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((section) => (
                      <>
                        <tr key={`${section.category}-header`} className="bg-muted/30">
                          <td
                            colSpan={3}
                            className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-foreground"
                          >
                            {section.category}
                          </td>
                        </tr>
                        {section.rows.map((row) => (
                          <tr
                            key={row.feature}
                            className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                          >
                            <td className="px-6 py-4 text-sm text-foreground">{row.feature}</td>
                            <td className="px-6 py-4 text-center">
                              <Cell value={row.free} />
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Cell value={row.pro} />
                            </td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground tracking-tight">
                Preguntas frecuentes
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: "¿Puedo cambiar de plan en cualquier momento?",
                  a: "Sí. Si pasas de FREE a PRO te activamos las funciones avanzadas en menos de 24 horas hábiles. Si vuelves a FREE conservas todos tus datos (reservas, clientes, pagos), solo se desactivan las funciones que exceden el límite.",
                },
                {
                  q: "¿Cómo se activa el plan PRO?",
                  a: "Escríbenos por WhatsApp o email y coordinamos la activación. El proceso es manual porque ajustamos el precio según el tamaño de tu operación.",
                },
                {
                  q: "¿Qué métodos de pago aceptan para PRO?",
                  a: "Transferencia bancaria o MercadoPago. Emitimos boleta de honorarios o factura según corresponda.",
                },
                {
                  q: "¿Mis datos están seguros si paso de PRO a FREE?",
                  a: "Sí. Tus reservas, clientes, propiedades y pagos no se eliminan. Solo se desactivan las funciones que exceden los límites del plan FREE (iCal, documentos, reportes con rango completo). Si superas los límites de FREE, los datos quedan ocultos hasta que subas de plan o limpies el excedente.",
                },
                {
                  q: "¿Hay descuento por pago anual?",
                  a: "Sí, consulta por nuestras tarifas anuales según el tamaño de tu operación.",
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-black/5 bg-white shadow-sm open:shadow-md transition-shadow"
                >
                  <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span className="font-medium text-foreground">{item.q}</span>
                    <span className="shrink-0 size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-open:bg-primary group-open:text-primary-foreground transition-colors">
                      <span className="text-xl leading-none group-open:hidden">+</span>
                      <span className="text-xl leading-none hidden group-open:inline">−</span>
                    </span>
                  </summary>
                  <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="bg-primary rounded-[3rem] p-12 md:p-20 text-center text-white shadow-2xl shadow-primary/40 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-brand-secondary/40 group-hover:scale-105 transition-transform duration-700" />
              <div className="relative z-10">
                <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight">
                  Empieza gratis hoy
                </h2>
                <p className="text-lg md:text-xl text-white/90 mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                  Crea tu cuenta en menos de 1 minuto. Sin tarjetas, sin compromisos.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Link
                    href="/register"
                    className="bg-white text-primary px-10 py-5 rounded-full text-lg font-bold shadow-2xl hover:scale-105 transition-transform text-center w-full sm:w-auto ring-8 ring-white/10"
                  >
                    Crear cuenta gratis
                  </Link>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white/10 text-white px-10 py-5 rounded-full text-lg font-bold backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all text-center w-full sm:w-auto inline-flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="size-5" />
                    Hablar por WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-16 px-6 border-t border-black/5 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="font-medium text-foreground">RentalPro</span>
            <span>· © 2026</span>
          </div>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-primary transition-colors">Inicio</Link>
            <Link href="/login" className="hover:text-primary transition-colors">Entrar</Link>
            <Link href="/register" className="hover:text-primary transition-colors">Registrarse</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
