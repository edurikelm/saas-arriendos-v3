"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Check, Calendar, Receipt, BarChart3, CreditCard, Sparkles, Star } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { buttonVariants } from "@/components/ui/button";
import { ScrollReveal } from "./scroll-reveal";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

function LogoMarquee() {
  return (
    <div className="py-12 border-y border-black/5 bg-white overflow-hidden select-none">
      <div className="marquee">
        <div className="marquee-content items-center">
          <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/Mercado_Pago_logo.svg" className="h-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-300" alt="Mercado Pago" />
          <span className="text-xl font-bold text-gray-300">AIRBNB</span>
          <span className="text-xl font-bold text-gray-300">BOOKING.COM</span>
          <span className="text-xl font-bold text-gray-300">VRBO</span>
          <span className="text-xl font-bold text-gray-300">EXPEDIA</span>
          <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/Mercado_Pago_logo.svg" className="h-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-300" alt="Mercado Pago" />
          <span className="text-xl font-bold text-gray-300">PROPERTY PRO</span>
        </div>
        <div className="marquee-content items-center" aria-hidden="true">
          <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/Mercado_Pago_logo.svg" className="h-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-300" alt="Mercado Pago" />
          <span className="text-xl font-bold text-gray-300">AIRBNB</span>
          <span className="text-xl font-bold text-gray-300">BOOKING.COM</span>
          <span className="text-xl font-bold text-gray-300">VRBO</span>
          <span className="text-xl font-bold text-gray-300">EXPEDIA</span>
          <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/Mercado_Pago_logo.svg" className="h-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-300" alt="Mercado Pago" />
          <span className="text-xl font-bold text-gray-300">PROPERTY PRO</span>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const heroTextRef = useRef<HTMLDivElement>(null);
  const heroVisualRef = useRef<HTMLDivElement>(null);
  const bentoGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.to(heroTextRef.current, { opacity: 1, y: 0, duration: 1, ease: "power4.out" })
        .to(heroVisualRef.current, { opacity: 1, scale: 1, duration: 1.2, ease: "power3.out" }, "-=0.5");

      gsap.to(".bento-card", {
        scrollTrigger: {
          trigger: bentoGridRef.current,
          start: "top 80%",
        },
        opacity: 1,
        y: 0,
        stagger: 0.1,
        duration: 0.8,
        ease: "power3.out"
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-white">
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
            <Link href="#features" className="hover:text-primary transition-colors">Características</Link>
            <Link href="#pricing" className="hover:text-primary transition-colors">Precios</Link>
            <Link href="#mercadopago" className="hover:text-primary transition-colors">Mercado Pago</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-sm font-semibold hover:text-primary transition-colors px-4 py-2")}>Entrar</Link>
            <Link href="/register" className={cn(buttonVariants({ size: "lg" }), "bg-primary text-white px-6 py-2.5 rounded-full text-sm font-semibold shadow-lg shadow-primary/20 hover:scale-105 transition-transform border-none hover:bg-primary/90")}>
              Empieza Gratis
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="pt-40 pb-24 px-6 relative hero-gradient overflow-hidden">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div ref={heroTextRef} className="opacity-0 translate-y-8 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-secondary/10 text-brand-secondary text-xs font-bold mb-6 border border-brand-secondary/20 uppercase tracking-wider">
                <Sparkles className="size-3" /> NUEVA VERSIÓN 2.0
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-8 text-foreground tracking-tight">
                Gestiona tus arriendos como un <span className="text-primary">vecino amigable</span>.
              </h1>
              <p className="text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed mx-auto lg:mx-0">
                Controla tus propiedades, sincroniza calendarios y cobra automáticamente con Mercado Pago. Todo en un solo lugar, diseñado para personas reales.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/register" className="bg-primary text-white px-10 py-5 rounded-full text-lg font-bold shadow-2xl shadow-primary/30 hover:scale-105 transition-transform flex items-center justify-center gap-2 group">
                  Pruébalo gratis hoy <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="#demo" className="px-10 py-5 rounded-full text-lg font-bold border-2 border-black/5 hover:bg-black/5 transition-colors text-center text-foreground">
                  Ver demo en vivo
                </Link>
              </div>
              <div className="mt-12 flex items-center gap-4 text-sm text-muted-foreground justify-center lg:justify-start">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map(i => (
                    <img key={i} src={`https://i.pravatar.cc/80?u=${i}`} className="size-10 rounded-full border-4 border-white shadow-sm" alt="User" />
                  ))}
                </div>
                <span className="font-medium">Unido por +200 administradores este mes</span>
              </div>
            </div>

            <div ref={heroVisualRef} className="relative opacity-0 scale-95 hidden lg:block">
              <div className="absolute -top-20 -right-20 size-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
              <div className="absolute -bottom-20 -left-20 size-96 bg-brand-secondary/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]"></div>
              
              <div className="relative z-10 grid grid-cols-12 gap-4">
                <div className="col-span-8 floating">
                  <div className="rounded-[2.5rem] overflow-hidden shadow-2xl border-[12px] border-white ring-1 ring-black/5">
                    <img src="https://images.unsplash.com/photo-1744782351841-9cc6b86a5add?auto=format&w=800&q=80&fit=crop" className="w-full h-auto" alt="Property Manager" />
                  </div>
                </div>
                
                <div className="col-span-6 col-start-7 -mt-48 floating [animation-delay:-1.5s]">
                  <div className="glass p-6 rounded-3xl shadow-2xl border border-white/50 ring-1 ring-black/5">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="size-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-inner">
                        <Check className="size-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-0.5">MERCADO PAGO</div>
                        <div className="text-base font-bold text-foreground">Pago Recibido</div>
                      </div>
                    </div>
                    <div className="text-3xl font-black mb-1 text-foreground tracking-tight">$450.000</div>
                    <div className="text-xs font-medium text-muted-foreground">Departamento 402 — Juan Pérez</div>
                  </div>
                </div>

                <div className="col-span-7 col-start-2 -mt-12 floating [animation-delay:-0.8s]">
                  <div className="bg-white p-5 rounded-3xl shadow-2xl border border-black/5 ring-1 ring-black/5">
                    <div className="text-xs font-bold mb-4 flex items-center justify-between">
                      <span className="text-muted-foreground uppercase tracking-widest">Disponibilidad</span>
                      <span className="text-primary font-black">Junio 2025</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {[10, 40, 100, 100, 20, 0, 0].map((opacity, i) => (
                        <div key={i} className={cn("h-1.5 rounded-full transition-all duration-500", opacity > 0 ? "bg-primary" : "bg-muted")} style={{ opacity: opacity / 100 || 0.1 }}></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Marquee */}
        <LogoMarquee />

        {/* Features Bento Grid */}
        <section id="features" className="py-32 px-6 bg-beige">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-24">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground tracking-tight">Todo lo que necesitas para crecer</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
                Olvida los Excels complejos. Hemos diseñado RentalPro para que sea intuitivo desde el primer clic.
              </p>
            </div>

            <div ref={bentoGridRef} className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-8 bg-white rounded-[2.5rem] p-12 shadow-sm border border-black/5 relative overflow-hidden bento-card opacity-0 translate-y-12">
                <div className="relative z-10 max-w-md text-left">
                  <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-8 shadow-inner">
                    <Calendar className="size-7" />
                  </div>
                  <h3 className="text-3xl font-bold mb-4 text-foreground tracking-tight">Calendario Timeline Maestro</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                    Visualiza todas tus propiedades en una sola línea de tiempo. Arrastra y suelta para mover reservas y gestiona la disponibilidad en tiempo real.
                  </p>
                </div>
                <div className="absolute -right-12 bottom-0 w-3/5 hidden lg:block">
                  <div className="bg-beige p-8 rounded-tl-[2rem] border-l border-t border-black/5 shadow-2xl ring-1 ring-black/5">
                    <div className="flex gap-6 mb-6">
                      <div className="w-32 h-5 bg-muted rounded-full opacity-50"></div>
                      <div className="flex-1 h-5 bg-primary/20 rounded-full"></div>
                    </div>
                    <div className="flex gap-6 mb-6">
                      <div className="w-32 h-5 bg-muted rounded-full opacity-50"></div>
                      <div className="flex-1 h-5 bg-primary rounded-full shadow-lg shadow-primary/20"></div>
                    </div>
                    <div className="flex gap-6">
                      <div className="w-32 h-5 bg-muted rounded-full opacity-50"></div>
                      <div className="flex-1 h-5 bg-muted rounded-full opacity-30"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:col-span-4 bg-white rounded-[2.5rem] p-12 shadow-sm border border-black/5 bento-card opacity-0 translate-y-12 text-left">
                <div className="size-14 rounded-2xl bg-brand-secondary/10 text-brand-secondary flex items-center justify-center mb-8 shadow-inner">
                  <Receipt className="size-7" />
                </div>
                <h3 className="text-3xl font-bold mb-4 text-foreground tracking-tight">Cobros Flexibles</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Soporta arriendos diarios y mensuales sin esfuerzo. Generamos las cuotas automáticamente para estadías largas.
                </p>
              </div>

              <div className="md:col-span-4 bg-white rounded-[2.5rem] p-12 shadow-sm border border-black/5 bento-card opacity-0 translate-y-12 text-left">
                <div className="size-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center mb-8 shadow-inner">
                  <BarChart3 className="size-7" />
                </div>
                <h3 className="text-3xl font-bold mb-4 text-foreground tracking-tight">Finanzas Claras</h3>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Reportes detallados de ingresos pagados y pendientes. Sé exactamente cuánto estás ganando por cada propiedad.
                </p>
              </div>

              <div className="md:col-span-8 bg-primary text-white rounded-[2.5rem] p-12 shadow-2xl shadow-primary/30 relative overflow-hidden bento-card opacity-0 translate-y-12 text-left">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                  <div className="flex-1">
                    <div className="size-14 rounded-2xl bg-white/20 flex items-center justify-center mb-8 shadow-inner">
                      <CreditCard className="size-7 text-white" />
                    </div>
                    <h3 className="text-3xl font-bold mb-4 tracking-tight">Integración con Mercado Pago</h3>
                    <p className="text-white/80 text-lg leading-relaxed">
                      Envía links de pago automáticos y recibe notificaciones cuando tu huésped pague. Tu dinero, directo a tu cuenta.
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="bg-white p-8 rounded-[2rem] text-gray-900 shadow-2xl ring-1 ring-black/5">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/Mercado_Pago_logo.svg" className="h-8 mb-6" alt="MP" />
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="size-2.5 rounded-full bg-green-500 animate-pulse"></div>
                          <span className="text-sm font-bold tracking-tight">Checkout Pro activo</span>
                        </div>
                        <div className="w-48 h-10 bg-gray-100 rounded-xl"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="mercadopago" className="py-32 px-6 overflow-hidden">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-24 italic font-serif text-foreground tracking-tight">El flujo perfecto de pago</h2>
            
            <div className="relative flex flex-col md:flex-row justify-between items-stretch gap-12 md:gap-8">
              <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 border-t-2 border-dashed border-primary/20 -z-10"></div>
              
              <ScrollReveal className="flex-1 flex" delay={0}>
                <div className="bg-white p-10 rounded-[2rem] border border-black/5 shadow-xl text-left relative flex flex-col w-full hover:shadow-2xl transition-shadow duration-300">
                  <div className="size-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl mb-8 -mt-16 shadow-lg ring-4 ring-white">1</div>
                  <h4 className="font-bold text-xl mb-3 text-foreground tracking-tight">Reserva Creada</h4>
                  <p className="text-muted-foreground leading-relaxed">Agregas la reserva al calendario en segundos. El sistema verifica disponibilidad automáticamente.</p>
                </div>
              </ScrollReveal>

              <ScrollReveal className="flex-1 flex" delay={150}>
                <div className="bg-white p-10 rounded-[2rem] border border-black/5 shadow-xl text-left relative flex flex-col w-full hover:shadow-2xl transition-shadow duration-300">
                  <div className="size-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl mb-8 -mt-16 shadow-lg ring-4 ring-white">2</div>
                  <h4 className="font-bold text-xl mb-3 text-foreground tracking-tight">Link Generado</h4>
                  <p className="text-muted-foreground leading-relaxed">RentalPro crea un link de Mercado Pago único. El huésped paga desde su celular en segundos.</p>
                </div>
              </ScrollReveal>

              <ScrollReveal className="flex-1 flex" delay={300}>
                <div className="bg-white p-10 rounded-[2rem] border border-black/5 shadow-xl text-left relative flex flex-col w-full hover:shadow-2xl transition-shadow duration-300">
                  <div className="size-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl mb-8 -mt-16 shadow-lg ring-4 ring-white">3</div>
                  <h4 className="font-bold text-xl mb-3 text-foreground tracking-tight">Confirmación</h4>
                  <p className="text-muted-foreground leading-relaxed">El pago se registra solo, la reserva se confirma y recibes una notificación al instante.</p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-32 px-6 bg-beige overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-center text-4xl md:text-5xl font-bold mb-24 font-serif text-foreground tracking-tight">Historias de anfitriones felices</h2>
            
            <div className="grid md:grid-cols-3 gap-16">
              {[
                { name: "María Elena", role: "Dueña de 4 cabañas", text: "Antes perdía horas cada semana coordinando reservas por WhatsApp. Con RentalPro tengo todo bajo control.", u: "maria", rot: "-rotate-2" },
                { name: "Carlos Ruiz", role: "Administrador", text: "La integración con Mercado Pago es magia. Ya no tengo que pedir comprobantes, el sistema lo hace por mí.", u: "carlos", rot: "rotate-1" },
                { name: "Lucía Méndez", role: "Propietaria", text: "Sencillo, rápido y confiable. Mis huéspedes están felices porque reciben confirmaciones profesionales.", u: "lucia", rot: "-rotate-1" }
              ].map((t, i) => (
                <ScrollReveal key={i} className="translate-y-0" delay={i * 150}>
                  <div className={cn("polaroid transition-all duration-500 hover:rotate-0 hover:scale-105 transform cursor-default", t.rot)}>
                    <div className="flex gap-1.5 mb-6">
                      {[1, 2, 3, 4, 5].map(j => <Star key={j} className="size-4 text-brand-secondary fill-brand-secondary" />)}
                    </div>
                    <p className="font-serif text-xl leading-relaxed mb-8 italic text-foreground tracking-tight">
                      &ldquo;{t.text}&rdquo;
                    </p>
                    <div className="flex items-center gap-4">
                      <img src={`https://i.pravatar.cc/120?u=${t.u}`} className="size-12 rounded-full grayscale hover:grayscale-0 transition-all duration-500" alt={t.name} />
                      <div className="text-left">
                        <div className="font-bold text-base text-foreground tracking-tight">{t.name}</div>
                        <div className="text-sm text-muted-foreground">{t.role}</div>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 px-6 bg-white overflow-hidden text-center">
          <div className="max-w-6xl mx-auto">
            <div className="bg-primary rounded-[3.5rem] p-12 md:p-24 text-center text-white shadow-2xl shadow-primary/40 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-brand-secondary/40 group-hover:scale-105 transition-transform duration-700"></div>
              <div className="relative z-10">
                <h2 className="text-5xl md:text-7xl font-bold mb-10 tracking-tight">¿Listo para retomar el control?</h2>
                <p className="text-xl md:text-2xl text-white/90 mb-16 max-w-3xl mx-auto leading-relaxed font-medium">
                  Únete a los cientos de propietarios que ya están ahorrando tiempo y aumentando sus ingresos con RentalPro.
                </p>
                <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                  <Link href="/register" className="bg-white text-primary px-12 py-6 rounded-full text-2xl font-black shadow-2xl hover:scale-105 transition-transform text-center w-full sm:w-auto ring-8 ring-white/10">
                    Empieza gratis hoy
                  </Link>
                  <Link href="https://wa.me/yournumber" className="bg-white/10 text-white px-12 py-6 rounded-full text-2xl font-bold backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all text-center w-full sm:w-auto">
                    Hablemos por WhatsApp
                  </Link>
                </div>
                <div className="mt-16 flex flex-wrap justify-center gap-8 text-sm text-white/70 font-bold uppercase tracking-widest">
                  <span className="flex items-center gap-2"><Check className="size-5" /> Sin tarjetas</span>
                  <span className="flex items-center gap-2"><Check className="size-5" /> Sin compromisos</span>
                  <span className="flex items-center gap-2"><Check className="size-5" /> Cancela cuando quieras</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-24 px-6 border-t border-black/5 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-16 mb-24 text-left">
            <div className="md:col-span-6 text-left">
              <Link href="/" className="flex items-center gap-3 mb-8">
                <div className="size-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                  <span className="text-white font-bold text-xl">R</span>
                </div>
                <span className="font-bold text-2xl tracking-tight text-foreground">RentalPro</span>
              </Link>
              <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
                La plataforma de gestión de arriendos más amigable del mercado chileno, integrada oficialmente con Mercado Pago.
              </p>
            </div>
            
            <div className="md:col-span-3 text-left">
              <h5 className="font-bold text-lg mb-8 text-foreground tracking-tight">Producto</h5>
              <ul className="space-y-5 text-base text-muted-foreground font-medium">
                <li><Link href="#features" className="hover:text-primary transition-colors text-muted-foreground">Funciones</Link></li>
                <li><Link href="#mercadopago" className="hover:text-primary transition-colors text-muted-foreground">Mercado Pago</Link></li>
                <li><Link href="#pricing" className="hover:text-primary transition-colors text-muted-foreground">Precios</Link></li>
              </ul>
            </div>

            <div className="md:col-span-3 text-left">
              <h5 className="font-bold text-lg mb-8 text-foreground tracking-tight">Legal</h5>
              <ul className="space-y-5 text-base text-muted-foreground font-medium">
                <li><Link href="#" className="hover:text-primary transition-colors text-muted-foreground">Privacidad</Link></li>
                <li><Link href="#" className="hover:text-primary transition-colors text-muted-foreground">Términos</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-12 border-t border-black/5 flex flex-col md:flex-row justify-between items-center gap-8 text-sm text-muted-foreground font-medium text-center md:text-left">
            <p>© 2025 RentalPro. Diseñado con ❤️ para administradores.</p>
            <div className="flex gap-10">
              <Link href="#" className="hover:text-primary transition-colors text-muted-foreground">Política de Privacidad</Link>
              <Link href="#" className="hover:text-primary transition-colors text-muted-foreground">Términos de Servicio</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
