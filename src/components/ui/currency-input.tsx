"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const formatCLP = (n: number): string =>
  new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

interface CurrencyInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  id?: string;
  label?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
}

export function CurrencyInput({
  value,
  onChange,
  id,
  label,
  placeholder = "0",
  required,
  disabled,
  className,
  error,
}: CurrencyInputProps) {
  const [display, setDisplay] = useState<string>("");

  // Sync display from external value changes (e.g., form reset)
  useEffect(() => {
    if (value === null || value === 0) {
      setDisplay("");
    } else {
      setDisplay(formatCLP(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");

    if (!raw) {
      setDisplay("");
      onChange(null);
      return;
    }

    const numeric = Number(raw);
    setDisplay(formatCLP(numeric));
    onChange(numeric);
  };

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <Label
          htmlFor={id}
          className="text-xs font-bold text-muted-foreground uppercase tracking-tighter"
        >
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={display}
          onChange={handleChange}
          disabled={disabled}
          aria-invalid={!!error}
          className="pl-7"
        />
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
