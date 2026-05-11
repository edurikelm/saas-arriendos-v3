"use client";

import { Bell, LogOut, Shield, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface DashboardNavbarProps {
  userName?: string | null;
  userRole?: string;
}

export function DashboardNavbar({ userName, userRole }: DashboardNavbarProps) {
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

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
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Cambiar tema">
          {mounted && theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
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