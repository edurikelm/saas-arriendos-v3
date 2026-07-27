"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Calendar,
  Receipt,
  BarChart3,
  CreditCard,
  Sparkles,
  Star,
} from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ScrollReveal } from "./scroll-reveal";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

// ─────────────────────────────────────────────────────────────────────────────
// Inline brand wordmarks (replaces hot-linked Wikimedia logos for reliability)
// ─────────────────────────────────────────────────────────────────────────────

function MercadoPagoWordmark({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Mercado Pago"
      viewBox="0 0 220 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="0"
        y="28"
        fontFamily="DM Sans, sans-serif"
        fontWeight="700"
        fontSize="26"
        fill="currentColor"
        letterSpacing="-0.5"
      >
        mercado
      </text>
      <text
        x="125"
        y="28"
        fontFamily="DM Sans, sans-serif"
        fontWeight="700"
        fontSize="26"
        fill="currentColor"
        letterSpacing="-0.5"
      >
        pago
      </text>
      <circle cx="118" cy="14" r="6" fill="currentColor" />
    </svg>
  );
}

function ChannelWordmark({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-xl font-bold tracking-tight text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Initials avatar (replaces pravatar.cc external service)
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({
  initials,
  ringClassName,
  size = 40,
  tone = "primary",
}: {
  initials: string;
  ringClassName?: string;
  size?: number;
  tone?: "primary" | "secondary";
}) {
  const bg = tone === "primary" ? "bg-primary" : "bg-brand-secondary";
  const fg = tone === "primary" ? "text-primary-foreground" : "text-white";
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold ring-4 ring-card",
        bg,
        fg,
        ringClassName,
      )}
    >
      <span
        className="text-xs"
        style={{ fontSize: Math.max(10, size * 0.32) }}
      >
        {initials}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Logo marquee — replaces hot-linked logos with branded wordmarks
// ─────────────────────────────────────────────────────────────────────────────

function LogoMarquee() {
  const items = [
    { kind: "mp" as const },
    { kind: "label" as const, label: "AIRBNB" },
    { kind: "label" as const, label: "BOOKING.COM" },
    { kind: "label" as const, label: "VRBO" },
    { kind: "label" as const, label: "EXPEDIA" },
    { kind: "label" as const, label: "PROPERTY PRO" },
  ];

  return (
    <section
      aria-label="Integraciones y plataformas compatibles"
      className="border-y border-border bg-background py-12 overflow-hidden select-none"
    >
      <div className="marquee">
        {[0, 1].map((dup) => (
          <div
            key={dup}
            className="marquee-content items-center"
            aria-hidden={dup === 1}
          >
            {items.map((item, i) =>
              item.kind === "mp" ? (
                <MercadoPagoWordmark
                  key={i}
                  className="h-7 text-muted-foreground/70"
                />
              ) : (
                <ChannelWordmark key={i} label={item.label!} />
              ),
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Property mock illustration (replaces Unsplash dependency)
// ─────────────────────────────────────────────────────────────────────────────

function PropertyIllustration() {
  return (
    <svg
      role="img"
      aria-label="Ilustración de una propiedad en arriendo"
      viewBox="0 0 800 600"
      className="w-full h-auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.92 0.04 200)" />
          <stop offset="100%" stopColor="oklch(0.97 0.02 200)" />
        </linearGradient>
        <linearGradient id="building" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.85 0.03 90)" />
          <stop offset="100%" stopColor="oklch(0.75 0.04 80)" />
        </linearGradient>
      </defs>
      {/* sky */}
      <rect width="800" height="600" fill="url(#sky)" />
      {/* hills */}
      <path
        d="M0 460 Q200 380 400 420 T800 400 V600 H0 Z"
        fill="oklch(0.72 0.10 160)"
        opacity="0.45"
      />
      <path
        d="M0 500 Q300 450 600 480 T800 470 V600 H0 Z"
        fill="oklch(0.65 0.12 155)"
        opacity="0.55"
      />
      {/* main building */}
      <rect x="180" y="220" width="440" height="280" fill="url(#building)" />
      <polygon
        points="160,220 400,140 640,220"
        fill="oklch(0.55 0.08 60)"
      />
      {/* windows grid */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <rect
            key={`w-${row}-${col}`}
            x={210 + col * 80}
            y={250 + row * 70}
            width="50"
            height="40"
            rx="4"
            fill="oklch(0.95 0.04 90)"
            stroke="oklch(0.55 0.05 80)"
            strokeWidth="2"
          />
        )),
      )}
      {/* door */}
      <rect
        x="370"
        y="430"
        width="60"
        height="70"
        rx="4"
        fill="oklch(0.45 0.08 60)"
      />
      <circle cx="418" cy="465" r="2" fill="oklch(0.85 0.10 90)" />
      {/* sun */}
      <circle
        cx="660"
        cy="120"
        r="44"
        fill="oklch(0.88 0.13 95)"
        opacity="0.9"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header className="fixed top-0 w-full z-50 glass border-b border-border/60 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 group"
          aria-label="RentalPro inicio"
        >
          <span className="size-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25 group-hover:scale-105 transition-transform">
            <span className="text-primary-foreground font-bold text-xl">
              R
            </span>
          </span>
          <span className="font-bold text-2xl tracking-tight text-foreground">
            RentalPro
          </span>
        </Link>

        <nav
          aria-label="Principal"
          className="hidden md:flex items-center gap-8 text-sm font-medium"
        >
          <Link
            href="/#features"
            className="hover:text-primary transition-colors"
          >
            Características
          </Link>
          <Link
            href="/pricing"
            className="hover:text-primary transition-colors"
          >
            Precios
          </Link>
          <Link
            href="/#mercadopago"
            className="hover:text-primary transition-colors"
          >
            Mercado Pago
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <div
            className="hidden md:flex items-center gap-2 pl-2 border-l border-border/60"
            aria-label="Preferencias"
          >
            <ThemeToggle />
          </div>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "px-4 py-2",
            )}
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "lg" }),
              "rounded-full px-6 py-2.5 shadow-lg shadow-primary/20 hover:scale-[1.03] transition-transform",
            )}
          >
            Empieza Gratis
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function Hero() {
  const heroTextRef = useRef<HTMLDivElement>(null);
  const heroVisualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.to(heroTextRef.current, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power4.out",
      }).to(
        heroVisualRef.current,
        { opacity: 1, scale: 1, duration: 1.2, ease: "power3.out" },
        "-=0.5",
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <section className="pt-40 pb-24 px-6 relative hero-gradient overflow-hidden">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        <div
          ref={heroTextRef}
          className="opacity-0 translate-y-8 text-center lg:text-left"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-xs font-bold mb-6 border border-accent uppercase tracking-wider">
            <Sparkles className="size-3" aria-hidden="true" />
            Diseño Ocean Breeze
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-8 text-foreground tracking-tight">
            Gestiona tus arriendos como un{" "}
            <span className="text-primary">vecino amigable</span>.
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed mx-auto lg:mx-0">
            Controla tus propiedades, sincroniza calendarios y cobra
            automáticamente con Mercado Pago. Todo en un solo lugar, diseñado
            para personas reales.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-full px-10 py-6 text-lg font-bold shadow-xl shadow-primary/25 hover:scale-[1.03] transition-transform flex items-center justify-center gap-2 group",
              )}
            >
              Pruébalo gratis hoy
              <ArrowRight
                className="size-5 group-hover:translate-x-1 transition-transform"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="#features"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "rounded-full px-10 py-6 text-lg font-bold",
              )}
            >
              Ver características
            </Link>
          </div>
          <div className="mt-12 flex items-center gap-4 text-sm text-muted-foreground justify-center lg:justify-start">
            <div
              className="flex -space-x-3"
              aria-hidden="true"
            >
              <Avatar initials="MC" tone="primary" />
              <Avatar initials="JR" tone="secondary" />
              <Avatar initials="LP" tone="primary" />
            </div>
            <span className="font-medium">
              Crea tu cuenta en menos de 2 minutos
            </span>
          </div>
        </div>

        <div
          ref={heroVisualRef}
          className="relative opacity-0 scale-95 hidden lg:block"
          aria-hidden="true"
        >
          <div className="absolute -top-20 -right-20 size-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-20 -left-20 size-96 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />

          <div className="relative z-10 grid grid-cols-12 gap-4">
            <div className="col-span-8 floating">
              <div className="rounded-[2.5rem] overflow-hidden shadow-2xl border-[12px] border-card ring-1 ring-border bg-card">
                <PropertyIllustration />
              </div>
            </div>

            <div className="col-span-6 col-start-7 -mt-48 floating [animation-delay:-1.5s]">
              <div className="glass p-6 rounded-3xl shadow-2xl border border-border/60 ring-1 ring-border">
                <div className="flex items-center gap-4 mb-5">
                  <div className="size-10 rounded-full bg-success/10 flex items-center justify-center text-success shadow-inner">
                    <Check className="size-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-0.5">
                      Mercado Pago
                    </div>
                    <div className="text-base font-bold text-foreground">
                      Pago Recibido
                    </div>
                  </div>
                </div>
                <div className="text-3xl font-black mb-1 text-foreground tracking-tight tabular-nums">
                  $450.000
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  Departamento 402 — Juan Pérez
                </div>
              </div>
            </div>

            <div className="col-span-7 col-start-2 -mt-12 floating [animation-delay:-0.8s]">
              <div className="bg-card p-5 rounded-3xl shadow-2xl border border-border ring-1 ring-border">
                <div className="text-xs font-bold mb-4 flex items-center justify-between">
                  <span className="text-muted-foreground uppercase tracking-widest">
                    Disponibilidad
                  </span>
                  <span className="text-primary font-black">Este mes</span>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {[40, 100, 100, 60, 20, 0, 0].map((opacity, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-500",
                        opacity > 0 ? "bg-primary" : "bg-muted",
                      )}
                      style={{ opacity: opacity ? opacity / 100 : 0.15 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Features Bento
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-card rounded-[2rem] p-10 md:p-12 border border-border shadow-sm bento-card opacity-0 translate-y-12 text-left",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FeaturesBento() {
  const bentoGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(".bento-card", {
        scrollTrigger: {
          trigger: bentoGridRef.current,
          start: "top 80%",
        },
        opacity: 1,
        y: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: "power3.out",
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="py-32 px-6 bg-beige"
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2
            id="features-title"
            className="text-4xl md:text-5xl font-bold mb-6 text-foreground tracking-tight"
          >
            Todo lo que necesitas para crecer
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
            Olvida los Excels complejos. RentalPro es intuitivo desde el primer
            clic.
          </p>
        </div>

        <div
          ref={bentoGridRef}
          className="grid grid-cols-1 md:grid-cols-12 gap-6"
        >
          <FeatureCard className="md:col-span-8 relative overflow-hidden">
            <div className="relative z-10 max-w-md">
              <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-8 shadow-inner">
                <Calendar className="size-7" aria-hidden="true" />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-foreground tracking-tight">
                Calendario Timeline Maestro
              </h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Visualiza todas tus propiedades en una sola línea de tiempo.
                Mueve reservas con un click y gestiona la disponibilidad en
                tiempo real.
              </p>
            </div>
            <div
              className="absolute -right-12 bottom-0 w-3/5 hidden lg:block"
              aria-hidden="true"
            >
              <div className="bg-beige p-8 rounded-tl-[2rem] border-l border-t border-border shadow-2xl ring-1 ring-border">
                <div className="flex gap-6 mb-6">
                  <div className="w-32 h-5 bg-muted rounded-full opacity-60" />
                  <div className="flex-1 h-5 bg-primary/20 rounded-full" />
                </div>
                <div className="flex gap-6 mb-6">
                  <div className="w-32 h-5 bg-muted rounded-full opacity-60" />
                  <div className="flex-1 h-5 bg-primary rounded-full shadow-lg shadow-primary/20" />
                </div>
                <div className="flex gap-6">
                  <div className="w-32 h-5 bg-muted rounded-full opacity-60" />
                  <div className="flex-1 h-5 bg-muted rounded-full opacity-30" />
                </div>
              </div>
            </div>
          </FeatureCard>

          <FeatureCard className="md:col-span-4">
            <div className="size-14 rounded-2xl bg-brand-secondary/10 text-brand-secondary flex items-center justify-center mb-8 shadow-inner">
              <Receipt className="size-7" aria-hidden="true" />
            </div>
            <h3 className="text-3xl font-bold mb-4 text-foreground tracking-tight">
              Cobros Flexibles
            </h3>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Soporta arriendos diarios y mensuales sin esfuerzo. Generamos las
              cuotas automáticamente para estadías largas.
            </p>
          </FeatureCard>

          <FeatureCard className="md:col-span-4">
            <div className="size-14 rounded-2xl bg-info/10 text-info flex items-center justify-center mb-8 shadow-inner">
              <BarChart3 className="size-7" aria-hidden="true" />
            </div>
            <h3 className="text-3xl font-bold mb-4 text-foreground tracking-tight">
              Finanzas Claras
            </h3>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Reportes detallados de ingresos pagados y pendientes. Sé
              exactamente cuánto estás ganando por cada propiedad.
            </p>
          </FeatureCard>

          <FeatureCard
            className={cn(
              "md:col-span-8 bg-primary text-primary-foreground shadow-2xl shadow-primary/30 overflow-hidden",
            )}
          >
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
              <div className="flex-1">
                <div className="size-14 rounded-2xl bg-primary-foreground/15 flex items-center justify-center mb-8 shadow-inner">
                  <CreditCard
                    className="size-7 text-primary-foreground"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-3xl font-bold mb-4 tracking-tight">
                  Integración con Mercado Pago
                </h3>
                <p className="text-primary-foreground/85 text-lg leading-relaxed">
                  Envía links de pago automáticos y recibe notificaciones cuando
                  tu huésped pague. Tu dinero, directo a tu cuenta.
                </p>
              </div>
              <div
                className="flex-shrink-0"
                aria-hidden="true"
              >
                <div className="bg-card p-8 rounded-[2rem] text-foreground shadow-2xl ring-1 ring-border">
                  <MercadoPagoWordmark className="h-7 mb-6 text-foreground" />
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="size-2.5 rounded-full bg-success animate-pulse" />
                      <span className="text-sm font-bold tracking-tight">
                        Checkout Pro activo
                      </span>
                    </div>
                    <div className="w-48 h-10 bg-muted rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow (numbered steps)
// ─────────────────────────────────────────────────────────────────────────────

function WorkflowStep({
  n,
  title,
  description,
  delay,
}: {
  n: string;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <ScrollReveal className="flex-1 flex" delay={delay}>
      <article className="bg-card p-10 rounded-[2rem] border border-border shadow-xl text-left relative flex flex-col w-full hover:shadow-2xl transition-shadow duration-300">
        <div className="size-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl mb-8 -mt-16 shadow-lg ring-4 ring-card">
          {n}
        </div>
        <h3 className="font-bold text-xl mb-3 text-foreground tracking-tight">
          {title}
        </h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </article>
    </ScrollReveal>
  );
}

function Workflow() {
  return (
    <section
      id="mercadopago"
      aria-labelledby="workflow-title"
      className="py-32 px-6 overflow-hidden"
    >
      <div className="max-w-5xl mx-auto text-center">
        <h2
          id="workflow-title"
          className="text-4xl md:text-5xl font-bold mb-20 italic font-serif text-foreground tracking-tight"
        >
          El flujo perfecto de pago
        </h2>

        <div className="relative flex flex-col md:flex-row justify-between items-stretch gap-12 md:gap-8">
          <div
            className="hidden md:block absolute top-12 left-0 w-full h-0.5 border-t-2 border-dashed border-primary/20 -z-10"
            aria-hidden="true"
          />

          <WorkflowStep
            n="1"
            title="Reserva creada"
            description="Agregas la reserva al calendario en segundos. El sistema verifica disponibilidad automáticamente."
            delay={0}
          />
          <WorkflowStep
            n="2"
            title="Link generado"
            description="RentalPro crea un link de Mercado Pago único. El huésped paga desde su celular en segundos."
            delay={150}
          />
          <WorkflowStep
            n="3"
            title="Confirmación"
            description="El pago se registra solo, la reserva se confirma y recibes una notificación al instante."
            delay={300}
          />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Testimonials (polaroid cards with initials avatars)
// ─────────────────────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    name: "María Elena",
    initials: "ME",
    role: "Dueña de 4 cabañas",
    text: "Antes perdía horas cada semana coordinando reservas por WhatsApp. Con RentalPro tengo todo bajo control.",
    rot: "-rotate-2",
    tone: "primary" as const,
  },
  {
    name: "Carlos Ruiz",
    initials: "CR",
    role: "Administrador",
    text: "La integración con Mercado Pago es magia. Ya no tengo que pedir comprobantes, el sistema lo hace por mí.",
    rot: "rotate-1",
    tone: "secondary" as const,
  },
  {
    name: "Lucía Méndez",
    initials: "LM",
    role: "Propietaria",
    text: "Sencillo, rápido y confiable. Mis huéspedes están felices porque reciben confirmaciones profesionales.",
    rot: "-rotate-1",
    tone: "primary" as const,
  },
];

function Testimonials() {
  return (
    <section
      aria-labelledby="testimonials-title"
      className="py-32 px-6 bg-beige overflow-hidden"
    >
      <div className="max-w-7xl mx-auto">
        <h2
          id="testimonials-title"
          className="text-center text-4xl md:text-5xl font-bold mb-20 font-serif text-foreground tracking-tight"
        >
          Historias de anfitriones felices
        </h2>

        <div className="grid md:grid-cols-3 gap-8 md:gap-16">
          {TESTIMONIALS.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 150}>
              <figure
                className={cn(
                  "polaroid transition-all duration-500 hover:rotate-0 hover:scale-[1.02] transform cursor-default",
                  t.rot,
                )}
              >
                <div
                  className="flex gap-1.5 mb-6"
                  aria-label="5 de 5 estrellas"
                >
                  {[1, 2, 3, 4, 5].map((j) => (
                    <Star
                      key={j}
                      className="size-4 text-brand-secondary fill-brand-secondary"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <blockquote className="font-serif text-xl leading-relaxed mb-8 italic text-card-foreground tracking-tight">
                  &ldquo;{t.text}&rdquo;
                </blockquote>
                <figcaption className="flex items-center gap-4">
                  <Avatar initials={t.initials} size={48} tone={t.tone} />
                  <div className="text-left">
                    <div className="font-bold text-base text-card-foreground tracking-tight">
                      {t.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t.role}
                    </div>
                  </div>
                </figcaption>
              </figure>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Final CTA
// ─────────────────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-32 px-6 bg-background overflow-hidden text-center">
      <div className="max-w-6xl mx-auto">
        <div className="bg-primary rounded-[2.5rem] p-12 md:p-24 text-center text-primary-foreground shadow-2xl shadow-primary/40 relative overflow-hidden group">
          <div
            className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-brand-secondary/40 group-hover:scale-105 transition-transform duration-700"
            aria-hidden="true"
          />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tight">
              ¿Listo para retomar el control?
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/90 mb-12 max-w-3xl mx-auto leading-relaxed font-medium">
              Únete a los propietarios que ahorran tiempo y aumentan sus
              ingresos con RentalPro. Configura tu primera propiedad hoy mismo.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "rounded-full bg-card text-primary hover:bg-card/90 px-10 py-6 text-lg font-bold shadow-2xl hover:scale-[1.03] transition-transform ring-8 ring-card/15",
                )}
              >
                Empieza gratis hoy
              </Link>
              <Link
                href="/pricing"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "rounded-full bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 border border-primary-foreground/20 px-10 py-6 text-lg font-bold backdrop-blur-md transition-all",
                )}
              >
                Ver precios
              </Link>
            </div>
            <ul className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-primary-foreground/85 font-bold uppercase tracking-widest">
              {[
                "Sin tarjetas",
                "Sin compromisos",
                "Cancela cuando quieras",
              ].map((label) => (
                <li
                  key={label}
                  className="flex items-center gap-2"
                >
                  <Check className="size-5" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="py-16 px-6 border-t border-border bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16 text-left">
          <div className="md:col-span-6">
            <Link
              href="/"
              className="flex items-center gap-3 mb-6"
              aria-label="RentalPro inicio"
            >
              <span className="size-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="text-primary-foreground font-bold text-xl">
                  R
                </span>
              </span>
              <span className="font-bold text-2xl tracking-tight text-foreground">
                RentalPro
              </span>
            </Link>
            <p className="text-muted-foreground text-base max-w-md leading-relaxed">
              La plataforma de gestión de arriendos más amigable del mercado
              chileno, integrada oficialmente con Mercado Pago.
            </p>
          </div>

          <div className="md:col-span-3">
            <h3 className="font-bold text-base mb-5 text-foreground tracking-tight">
              Producto
            </h3>
            <ul className="space-y-3 text-sm text-muted-foreground font-medium">
              <li>
                <Link
                  href="#features"
                  className="hover:text-primary transition-colors"
                >
                  Funciones
                </Link>
              </li>
              <li>
                <Link
                  href="#mercadopago"
                  className="hover:text-primary transition-colors"
                >
                  Mercado Pago
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="hover:text-primary transition-colors"
                >
                  Precios
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <h3 className="font-bold text-base mb-5 text-foreground tracking-tight">
              Legal
            </h3>
            <ul className="space-y-3 text-sm text-muted-foreground font-medium">
              <li>
                <Link href="#" className="hover:text-primary transition-colors">
                  Privacidad
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary transition-colors">
                  Términos
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground font-medium text-center md:text-left">
          <p>© {new Date().getFullYear()} RentalPro. Hecho con cuidado para anfitriones.</p>
          <nav
            aria-label="Legal"
            className="flex gap-8"
          >
            <Link href="#" className="hover:text-primary transition-colors">
              Política de Privacidad
            </Link>
            <Link href="#" className="hover:text-primary transition-colors">
              Términos de Servicio
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page composition
// ─────────────────────────────────────────────────────────────────────────────

function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-card focus:text-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-ring"
    >
      Saltar al contenido principal
    </a>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink />
      <Header />
      <main id="main">
        <Hero />
        <LogoMarquee />
        <FeaturesBento />
        <Workflow />
        <Testimonials />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}