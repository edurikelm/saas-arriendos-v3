"use client";

import { CalendarDays, LogOut, Moon, Shield, Sun, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/actions/auth";
import { useTheme } from "@/components/providers/theme-provider";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useEffect, useState } from "react";

interface DashboardNavbarProps {
  userName?: string | null;
  userRole?: string;
  userPlan?: string | null;
  notificationUnreadCount?: number;
}

export function DashboardNavbar({ userName, userRole, userPlan, notificationUnreadCount = 0 }: DashboardNavbarProps) {
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [dateLabel, setDateLabel] = useState("");
  const displayName = userName ?? "de vuelta";
  const initial = (userName?.[0] ?? "R").toUpperCase();
  const planLabel = isSuperAdmin ? "ADMIN" : userPlan ?? "FREE";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration safety
    setMounted(true);
    setDateLabel(
      new Intl.DateTimeFormat("es-CL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date())
    );
  }, []);

  return (
    <header className="sticky top-0 z-30 hidden border-b bg-navbar/90 text-navbar-foreground backdrop-blur-xl lg:block">
      <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <div className="hidden min-w-0 lg:block">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              {isSuperAdmin ? <Shield className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold tracking-tight">
                  {isSuperAdmin ? "Panel de Super Admin" : `Hola, ${displayName}`}
                </h2>
                <Badge
                  variant={planLabel === "PRO" ? "default" : "secondary"}
                  className="h-6 rounded-md px-2.5 text-[11px] tracking-wide"
                >
                  {planLabel}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isSuperAdmin ? "Control global de propietarios y métricas" : "Gestiona tus reservas, propiedades y disponibilidad"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          {dateLabel && (
            <div className="hidden items-center gap-2 rounded-lg border bg-background/70 px-3 py-2 text-sm text-muted-foreground xl:flex">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="capitalize">{dateLabel}</span>
            </div>
          )}
          {isSuperAdmin && (
            <div className="hidden items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-primary ring-1 ring-primary/20 sm:flex">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Super Admin</span>
            </div>
          )}
          <div className="flex items-center gap-1 rounded-lg border bg-background/70 p-1">
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Cambiar tema" className="rounded-lg" />}>
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Cambiar tema</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => setTheme("light")}>Claro</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")}>Oscuro</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")}>Sistema</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="icon" disabled className="rounded-lg">
                <Moon className="h-5 w-5" />
              </Button>
            )}
            <NotificationBell unreadCount={notificationUnreadCount} />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" aria-label="Menú de usuario" className="h-9 rounded-lg px-1.5 pr-2" />}>
                <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
                  {initial}
                </span>
                <span className="hidden max-w-24 truncate text-sm font-medium sm:inline">{userName ?? "Cuenta"}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                  <span className="block text-foreground">{userName ?? "Cuenta RentalPro"}</span>
                  <span className="block text-xs font-normal text-muted-foreground">Plan {planLabel}</span>
                </div>
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
