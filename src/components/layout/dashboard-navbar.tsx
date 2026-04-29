"use client";

import { Bell, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardNavbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      <div>
        <h2 className="text-lg font-medium">Bienvenido de vuelta</h2>
      </div>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <User className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}