"use client";

import { Bell, LogOut, Shield, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/actions/auth";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface DashboardNavbarProps {
  userName?: string | null;
  userRole?: string;
}

export function DashboardNavbar({ userName, userRole }: DashboardNavbarProps) {
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="hidden lg:block">
        <h2 className="text-lg font-medium">
          {isSuperAdmin ? "Panel de Super Admin" : userName ? `Bienvenido, ${userName}` : "Bienvenido de vuelta"}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        {isSuperAdmin && (
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Super Admin</span>
          </div>
        )}
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Cambiar tema" />}>
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Cambiar tema</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                Claro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                Oscuro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                Sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="icon" disabled>
            <Moon className="h-5 w-5" />
          </Button>
        )}
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
        <form action={logoutAction}>
          <Button variant="ghost" size="icon" type="submit">
            <LogOut className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </header>
  );
}