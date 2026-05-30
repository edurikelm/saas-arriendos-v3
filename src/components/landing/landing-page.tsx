import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CreditCard, BarChart3, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";

function BrowserMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto max-w-3xl">
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
        <div className="bg-background p-4">
          {children}
        </div>
      </div>
    </div>
  );
}

function DashboardPlaceholder() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-muted p-3 space-y-2">
          <div className="text-xs text-muted-foreground">Propiedades</div>
          <div className="text-xl font-semibold">12</div>
        </div>
        <div className="rounded-lg bg-muted p-3 space-y-2">
          <div className="text-xs text-muted-foreground">Reservas</div>
          <div className="text-xl font-semibold">28</div>
        </div>
        <div className="rounded-lg bg-muted p-3 space-y-2">
          <div className="text-xs text-muted-foreground">Ingresos</div>
          <div className="text-xl font-semibold">$2.4M</div>
        </div>
      </div>
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="text-sm font-medium">Calendario de Reservas</div>
        <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
            <div key={d} className="text-center py-1">{d}</div>
          ))}
          {Array.from({ length: 28 }).map((_, i) => {
            const day = i + 1;
            const hasReservation = [3, 4, 5, 10, 11, 17, 18, 19, 24, 25].includes(day);
            const isExternal = [7, 8, 14, 21, 22].includes(day);
            return (
              <div
                key={i}
                className={`aspect-square rounded-md flex items-center justify-center text-[10px]
                  ${hasReservation ? 'bg-primary/20 text-primary font-medium' : ''}
                  ${isExternal ? 'bg-accent/30 text-accent-foreground' : ''}
                  ${!hasReservation && !isExternal ? 'text-muted-foreground/50' : ''}
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

function ProblemSolution({
  problem,
  solution,
  icon: Icon,
}: {
  problem: string;
  solution: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex shrink-0 size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{problem}</p>
        <p className="text-sm text-muted-foreground">{solution}</p>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">R</span>
            </div>
            <span className="font-semibold text-foreground">RentalPro</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Iniciar sesión
            </Link>
            <Link href="/register?utm_source=landing&utm_campaign=header" className={buttonVariants({ size: "sm" })}>
              Empieza gratis
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="py-16 lg:py-24 px-4 lg:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 text-center lg:text-left hero-animate">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-tight">
                  Gestiona tus arriendos<br />sin complicaciones
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
                  Controla propiedades, reservas y pagos desde un solo lugar.
                  Sin Excel, sin perder tiempo, sin deuda con huéspedes.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <Link href="/register?utm_source=landing&utm_campaign=hero" className={buttonVariants({ size: "lg" })}>
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
              <ScrollReveal id="demo" className="fade-only">
                <BrowserMockup>
                  <DashboardPlaceholder />
                </BrowserMockup>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <ScrollReveal>
          <section className="py-12 px-4 lg:px-6 bg-muted/30 border-y border-border">
            <div className="mx-auto max-w-6xl">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
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
                    <svg viewBox="0 0 50 50" className="h-6 w-auto" fill="none">
                      <rect width="50" height="50" rx="8" fill="#00B1EA"/>
                      <path d="M25 10c-8.284 0-15 6.716-15 15s6.716 15 15 15 15-6.716 15-15-6.716-15-15-15zm0 24.5c-5.247 0-9.5-4.253-9.5-9.5s4.253-9.5 9.5-9.5 9.5 4.253 9.5 9.5-4.253 9.5-9.5 9.5z" fill="#fff"/>
                      <path d="M25 17c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zm0 12.5c-2.485 0-4.5-2.015-4.5-4.5s2.015-4.5 4.5-4.5 4.5 2.015 4.5 4.5-2.015 4.5-4.5 4.5z" fill="#fff"/>
                      <circle cx="32" cy="18" r="4" fill="#00B1EA"/>
                    </svg>
                    <span className="text-sm font-medium text-foreground">Mercado Pago</span>
                  </div>
                  <div className="text-sm text-muted-foreground">Integración oficial</div>
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>

        <section className="py-16 lg:py-24 px-4 lg:px-6">
          <ScrollReveal>
            <div className="mx-auto max-w-3xl text-center space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                ¿Te suena familiar?
              </h2>
              <p className="text-muted-foreground">
                Estos son los problemas que todo dueño de arriendos enfrenta cada día.
              </p>
            </div>
          </ScrollReveal>
          <div className="mx-auto max-w-3xl mt-12 space-y-8">
            <ScrollReveal delay={0}>
              <ProblemSolution
                icon={Calendar}
                problem="¿Cansado de manejar reservas en Excel y WhatsApp?"
                solution="Calendario unificado con todas tus propiedades. Disponibilidad en tiempo real, sin duplicados ni errores."
              />
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <ProblemSolution
                icon={CreditCard}
                problem="¿Cobrar por Mercado Pago sin complicaciones?"
                solution="Pagos integrados con Mercado Pago. Webhooks automáticos, estado en tiempo real, sin seguimiento manual."
              />
            </ScrollReveal>
            <ScrollReveal delay={200}>
              <ProblemSolution
                icon={BarChart3}
                problem="¿Saber exactamente cuánto has ganado?"
                solution="Reportes de ingresos por propiedad, reserva y período. Estadías diarias o mensuales, todo claro."
              />
            </ScrollReveal>
          </div>
        </section>

        <ScrollReveal>
          <section className="py-12 px-4 lg:px-6 bg-muted/30 border-y border-border">
            <div className="mx-auto max-w-3xl">
              <Card className="card-hover">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="size-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg">⭐</span>
                    </div>
                    <blockquote className="space-y-2">
                      <p className="text-sm text-foreground italic">
                        &ldquo;Antes perdía horas cada semana coordinando reservas por WhatsApp.
                        Con RentalPro tengo todo en un solo lugar y mis huéspedes están más tranquilos
                        porque reciben confirmaciones automáticas.&rdquo;
                      </p>
                      <footer className="text-xs text-muted-foreground">
                        — María Elena, propietaria de 4 departamentos en Valparaíso
                      </footer>
                    </blockquote>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </ScrollReveal>

        <section className="py-16 lg:py-24 px-4 lg:px-6">
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center space-y-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Empieza hoy, sin compromiso
              </h2>
              <p className="text-muted-foreground">
                Regístrate en 2 minutos. Tu plan FREE incluye 3 propiedades y 5 clientes
                para siempre, sin límite de tiempo.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/register?utm_source=landing&utm_campaign=cta" className={buttonVariants({ size: "lg" })}>
                  Crear mi cuenta gratis
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </div>
              <div className="flex items-center justify-center gap-6 pt-4">
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
          </ScrollReveal>
        </section>
      </main>

      <footer className="border-t border-border py-8 px-4 lg:px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">R</span>
            </div>
            <span>RentalPro</span>
          </div>
          <p>© 2025 RentalPro. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
