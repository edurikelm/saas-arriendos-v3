"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const VARIANTS = [
  { key: "D", name: "Modern Timeline" },
  { key: "A", name: "Stitch Design" },
  { key: "B", name: "Stats First" },
  { key: "C", name: "Compact List" },
];

export function DashboardPrototypeSwitcher({
  currentVariant,
}: {
  currentVariant: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentIndex = VARIANTS.findIndex((v) => v.key === currentVariant);
  const prevVariant = VARIANTS[(currentIndex - 1 + VARIANTS.length) % VARIANTS.length];
  const nextVariant = VARIANTS[(currentIndex + 1) % VARIANTS.length];

  const navigateTo = (variant: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", variant);
    router.replace(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-1 bg-foreground text-background rounded-full px-2 py-1 shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-background/20"
          onClick={() => navigateTo(prevVariant.key)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 px-2 min-w-[140px] justify-center">
          <span className="text-sm font-medium">{currentVariant}</span>
          <span className="text-xs opacity-70">—</span>
          <span className="text-sm">
            {VARIANTS.find((v) => v.key === currentVariant)?.name}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-background/20"
          onClick={() => navigateTo(nextVariant.key)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}