"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration safety
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const toggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  // Antes del mount: mostramos Moon (asumimos light) para evitar mismatch SSR/CSR.
  // Después del mount: mostramos el icono del modo AL QUE se va a cambiar.
  const Icon = mounted && isDark ? Sun : Moon;
  const label = mounted && isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="p-2 text-foreground hover:text-primary transition-colors"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}