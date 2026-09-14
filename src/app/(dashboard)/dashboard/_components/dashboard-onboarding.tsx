import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardOnboardingProps {
  hasProperties: boolean;
}

interface Step {
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
}

/**
 * Inicio de una cuenta sin reservas.
 *
 * Sin reservas, cada sección del inicio es una caja vacía o un cero: agenda
 * sin eventos, cobros en $0, un tablero donde todo está libre. En vez de un
 * muro de nada, el camino hasta la primera reserva.
 *
 * Son dos pasos y no tres: el formulario de reserva crea al cliente en el
 * mismo flujo ("Crear nuevo cliente..."), así que "registra un cliente" como
 * paso aparte sería un desvío.
 */
export function DashboardOnboarding({ hasProperties }: DashboardOnboardingProps) {
  const steps: Step[] = [
    {
      title: "Agrega tu primera propiedad",
      description: "Con sus unidades y su precio por noche o por mes.",
      href: "/properties/new",
      cta: "Agregar propiedad",
      done: hasProperties,
    },
    {
      title: "Crea tu primera reserva",
      description: "El cliente lo registras en el mismo formulario.",
      href: "/reservations?create=true",
      cta: "Crear reserva",
      done: false,
    },
  ];
  const currentIndex = steps.findIndex((step) => !step.done);

  return (
    <section
      aria-labelledby="primeros-pasos-heading"
      className="overflow-hidden rounded-md border border-border bg-card"
    >
      <div className="border-b border-border px-4 py-3">
        <h2
          id="primeros-pasos-heading"
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
        >
          Primeros pasos
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Con tu primera reserva, acá vas a ver quién llega, quién sale y qué falta cobrar.
        </p>
      </div>
      <ol className="divide-y divide-border">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          return (
            <li key={step.href} className="flex items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                  step.done
                    ? "bg-success/10 text-success-text"
                    : isCurrent
                      ? "bg-primary/10 text-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {step.done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-xs font-bold",
                    step.done ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {step.done && <span className="sr-only">Hecho: </span>}
                  {step.title}
                </p>
                {!step.done && (
                  <p className="text-[10px] text-muted-foreground">{step.description}</p>
                )}
              </div>
              {isCurrent && (
                <Link href={step.href} className={cn(buttonVariants({ size: "sm" }), "shrink-0")}>
                  {step.cta}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
