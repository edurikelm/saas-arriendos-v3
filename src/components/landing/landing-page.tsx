import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CreditCard, BarChart3, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";

function BrowserMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xl ring-1 ring-foreground/10">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="size-3 rounded-full bg-red-400/60" />
            <div className="size-3 rounded-full bg-yellow-400/60" />
            <div className="size-3 rounded-full bg-green-400/60" />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2 rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
              <span>rentalpro.app/dashboard</span>
            </div>
          </div>
          <div className="w-16" />
        </div>
        <div className="bg-background p-4">{children}</div>
      </div>
    </div>
  );
}

function DashboardPlaceholder() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2 rounded-lg bg-muted p-3">
          <div className="text-xs text-muted-foreground">Propiedades</div>
          <div className="text-xl font-semibold">12</div>
        </div>
        <div className="space-y-2 rounded-lg bg-muted p-3">
          <div className="text-xs text-muted-foreground">Reservas</div>
          <div className="text-xl font-semibold">28</div>
        </div>
        <div className="space-y-2 rounded-lg bg-muted p-3">
          <div className="text-xs text-muted-foreground">Ingresos</div>
          <div className="text-xl font-semibold">$2.4M</div>
        </div>
      </div>
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="text-sm font-medium">Calendario de Reservas</div>
        <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground">
          {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
            <div key={d} className="py-1 text-center">
              {d}
            </div>
          ))}
          {Array.from({ length: 28 }).map((_, i) => {
            const day = i + 1;
            const hasReservation = [3, 4, 5, 10, 11, 17, 18, 19, 24, 25].includes(day);
            const isExternal = [7, 8, 14, 21, 22].includes(day);
            return (
              <div
                key={i}
                className={`flex aspect-square items-center justify-center rounded-md text-[10px]
                  ${hasReservation ? "bg-primary/20 font-medium text-primary" : ""}
                  ${isExternal ? "bg-accent/30 text-accent-foreground" : ""}
                  ${!hasReservation && !isExternal ? "text-muted-foreground/50" : ""}
                `}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  problem,
  solution,
  icon: Icon,
}: {
  problem: string;
  solution: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="card-hover h-full">
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold leading-snug text-foreground text-balance">{problem}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{solution}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">R</span>
            </div>
            <span className="font-semibold text-foreground">RentalPro</span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Iniciar sesión
            </Link>
            <Link
              href="/register?utm_source=landing&utm_campaign=header"
              className={buttonVariants({ size: "sm" })}
            >
              Empieza gratis
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-20 lg:px-6 lg:py-28">
          <div
            className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_36rem)]"
            aria-hidden="true"
          />
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="hero-animate space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  Pagos integrados con Mercado Pago
                </div>
                <h1 className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Gestiona tus arriendos sin complicaciones
                </h1>
                <p className="mx-auto max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground lg:mx-0">
                  Controla propiedades, reservas y pagos desde un solo lugar. Sin Excel, sin perder tiempo, sin
                  deuda con huéspedes.
                </p>
                <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                  <Link
                    href="/register?utm_source=landing&utm_campaign=hero"
                    className={buttonVariants({ size: "lg" })}
                  >
                    Empieza gratis
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                  <Link href="#demo" className={buttonVariants({ variant: "outline", size: "lg" })}>
                    Ver demo
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sin tarjeta de crédito · 3 propiedades gratis para siempre
                </p>
              </div>
              <ScrollReveal id="demo" className="fade-only scroll-mt-24">
                <BrowserMockup>
                  <DashboardPlaceholder />
                </BrowserMockup>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Stats */}
        <ScrollReveal>
          <section className="border-y border-border bg-muted/30 px-4 py-12 lg:px-6">
            <div className="mx-auto max-w-6xl">
              <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">+200</div>
                  <div className="text-sm text-muted-foreground">Propiedades gestionadas</div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">+850</div>
                  <div className="text-sm text-muted-foreground">Reservas procesadas</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <svg viewBox="0 0 50 50" className="h-6 w-auto" fill="none" aria-hidden="true">
                      <rect width="50" height="50" rx="8" fill="#00B1EA" />
                      <path
                        d="M25 10c-8.284 0-15 6.716-15 15s6.716 15 15 15 15-6.716 15-15-6.716-15-15-15zm0 24.5c-5.247 0-9.5-4.253-9.5-9.5s4.253-9.5 9.5-9.5 9.5 4.253 9.5 9.5-4.253 9.5-9.5 9.5z"
                        fill="#fff"
                      />
                      <path
                        d="M25 17c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zm0 12.5c-2.485 0-4.5-2.015-4.5-4.5s2.015-4.5 4.5-4.5 4.5 2.015 4.5 4.5-2.015 4.5-4.5 4.5z"
                        fill="#fff"
                      />
                      <circle cx="32" cy="18" r="4" fill="#00B1EA" />
                    </svg>
                    <span className="text-sm font-medium text-foreground">Mercado Pago</span>
                  </div>
                  <div className="text-sm text-muted-foreground">Integración oficial</div>
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* Features / Problem-Solution */}
        <section className="px-4 py-20 lg:px-6 lg:py-28">
          <ScrollReveal>
            <div className="mx-auto max-w-2xl space-y-4 text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                ¿Te suena familiar?
              </h2>
              <p className="text-pretty text-muted-foreground">
                Estos son los problemas que todo dueño de arriendos enfrenta cada día, y cómo RentalPro los
                resuelve.
              </p>
            </div>
          </ScrollReveal>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            <ScrollReveal delay={0} className="h-full">
              <FeatureCard
                icon={Calendar}
                problem="¿Cansado de manejar reservas en Excel y WhatsApp?"
                solution="Calendario unificado con todas tus propiedades. Disponibilidad en tiempo real, sin duplicados ni errores."
              />
            </ScrollReveal>
            <ScrollReveal delay={100} className="h-full">
              <FeatureCard
                icon={CreditCard}
                problem="¿Cobrar por Mercado Pago sin complicaciones?"
                solution="Pagos integrados con Mercado Pago. Webhooks automáticos, estado en tiempo real, sin seguimiento manual."
              />
            </ScrollReveal>
            <ScrollReveal delay={200} className="h-full">
              <FeatureCard
                icon={BarChart3}
                problem="¿Saber exactamente cuánto has ganado?"
                solution="Reportes de ingresos por propiedad, reserva y período. Estadías diarias o mensuales, todo claro."
              />
            </ScrollReveal>
          </div>
        </section>

        {/* Testimonial */}
        <ScrollReveal>
          <section className="border-y border-border bg-muted/30 px-4 py-16 lg:px-6">
            <div className="mx-auto max-w-3xl">
              <Card className="card-hover border-none bg-card shadow-md">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Sparkles className="size-5" />
                    </div>
                    <blockquote className="space-y-4">
                      <p className="text-balance text-lg leading-relaxed text-foreground">
                        &ldquo;Antes perdía horas cada semana coordinando reservas por WhatsApp. Con RentalPro
                        tengo todo en un solo lugar y mis huéspedes están más tranquilos porque reciben
                        confirmaciones automáticas.&rdquo;
                      </p>
                      <footer className="text-sm font-medium text-muted-foreground">
                        — María Elena, propietaria de 4 departamentos en Valparaíso
                      </footer>
                    </blockquote>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </ScrollReveal>

        {/* Final CTA */}
        <section className="px-4 py-20 lg:px-6 lg:py-28">
          <ScrollReveal>
            <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-muted/30 px-6 py-12 text-center sm:px-12 sm:py-16">
              <div className="mx-auto max-w-2xl space-y-6">
                <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Empieza hoy, sin compromiso
                </h2>
                <p className="text-pretty text-muted-foreground">
                  Regístrate en 2 minutos. Tu plan FREE incluye 3 propiedades y 5 clientes para siempre, sin
                  límite de tiempo.
                </p>
                <div className="flex flex-col justify-center gap-3 sm:flex-row">
                  <Link
                    href="/register?utm_source=landing&utm_campaign=cta"
                    className={buttonVariants({ size: "lg" })}
                  >
                    Crear mi cuenta gratis
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-4 text-green-500" />
                    <span>Sin tarjeta</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-4 text-green-500" />
                    <span>Sin contrato</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-4 text-green-500" />
                    <span>Cancela cuando quieras</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 lg:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary">
              <span className="text-xs font-bold text-primary-foreground">R</span>
            </div>
            <span>RentalPro</span>
          </div>
          <p>© 2025 RentalPro. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
