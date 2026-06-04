"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: "class";
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  storageKey?: string;
}

interface ThemeProviderState {
  themes: Theme[];
  theme: Theme;
  setTheme: Dispatch<SetStateAction<Theme>>;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
}

const MEDIA_QUERY = "(prefers-color-scheme: dark)";

const initialState: ThemeProviderState = {
  themes: ["light", "dark", "system"],
  theme: "system",
  setTheme: () => undefined,
  resolvedTheme: "light",
  systemTheme: "light",
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light";
}

function getStoredTheme(storageKey: string, defaultTheme: Theme): Theme {
  try {
    const storedTheme = localStorage.getItem(storageKey);
    return isTheme(storedTheme) ? storedTheme : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

function disableTransitionsTemporarily() {
  const css = document.createElement("style");
  css.appendChild(document.createTextNode("*{transition:none!important}"));
  document.head.appendChild(css);

  return () => {
    window.getComputedStyle(document.body);
    window.setTimeout(() => css.remove(), 1);
  };
}

function resolveTheme(theme: Theme, enableSystem: boolean): ResolvedTheme {
  if (theme === "system") return enableSystem ? getSystemTheme() : "light";
  return theme;
}

function applyTheme(theme: Theme, enableSystem: boolean, disableTransitionOnChange: boolean) {
  const root = document.documentElement;
  const resolvedTheme = resolveTheme(theme, enableSystem);
  if (root.classList.contains(resolvedTheme) && root.style.colorScheme === resolvedTheme) return;

  const restoreTransitions = disableTransitionOnChange ? disableTransitionsTemporarily() : undefined;
  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.style.colorScheme = resolvedTheme;
  restoreTransitions?.();
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
  storageKey = "theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme(storageKey, defaultTheme));
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());
  const resolvedTheme = theme === "system" && enableSystem ? systemTheme : resolveTheme(theme, enableSystem);

  const setTheme = useCallback(
    (value: SetStateAction<Theme>) => {
      setThemeState((currentTheme) => {
        const nextTheme = typeof value === "function" ? value(currentTheme) : value;

        try {
          localStorage.setItem(storageKey, nextTheme);
        } catch {
          // Storage may be unavailable in private browsing or restricted contexts.
        }

        return nextTheme;
      });
    },
    [storageKey]
  );

  useEffect(() => {
    if (attribute !== "class") return;
    applyTheme(theme, enableSystem, disableTransitionOnChange);
  }, [attribute, disableTransitionOnChange, enableSystem, systemTheme, theme]);

  useEffect(() => {
    const media = window.matchMedia(MEDIA_QUERY);
    const updateSystemTheme = () => setSystemTheme(getSystemTheme());

    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      setThemeState(isTheme(event.newValue) ? event.newValue : defaultTheme);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [defaultTheme, storageKey]);

  return (
    <ThemeProviderContext.Provider
      value={{
        themes: ["light", "dark", "system"],
        theme,
        setTheme,
        resolvedTheme,
        systemTheme,
      }}
    >
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeProviderContext);
}
