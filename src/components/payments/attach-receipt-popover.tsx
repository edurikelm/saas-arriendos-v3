"use client";

import { useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReceiptUpload } from "@/components/ui/receipt-upload";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface AttachReceiptPopoverProps {
  /** Trigger button label (e.g., "Adjuntar comprobante"). */
  triggerLabel: string;
  /** Trigger button tooltip. */
  triggerTooltip: string;
  /** Compact cell — reduces trigger size. */
  compact?: boolean;
  /** Trigger button variant. `outline` (default) para celdas de tabla; `link`
   *  para columnas de acciones donde el resto ya son botones de texto. */
  variant?: "outline" | "link";
  /** Clases extra del trigger — permite alinear el botón con sus vecinos. */
  triggerClassName?: string;
  /**
   * Called when user submits the file. Should:
   * 1. Upload the file to /api/upload
   * 2. Call attachReceipt server action
   * 3. Return { error?: string }
   *
   * Popover auto-closes on success.
   */
  onSubmit: (file: File) => Promise<{ error?: string }>;
}

export function AttachReceiptPopover({
  triggerLabel,
  triggerTooltip,
  compact = false,
  variant = "outline",
  triggerClassName,
  onSubmit,
}: AttachReceiptPopoverProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async () => {
    if (!file) return;
    setIsUploading(true);
    const result = await onSubmit(file);
    setIsUploading(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Comprobante adjuntado");
    setOpen(false);
    setFile(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (isUploading) return; // Prevent close during upload
    setOpen(next);
    if (!next) setFile(null);
  };

  const btnHeight = compact ? "h-6" : "h-7";
  const btnText = compact ? "text-[10px]" : "text-xs";
  const iconSize = compact ? "size-3" : "size-3.5";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            size="sm"
            variant={variant}
            className={cn(btnHeight, variant === "link" ? "px-1" : "px-2", btnText, triggerClassName)}
            title={triggerTooltip}
            aria-label={triggerTooltip}
          >
            <Paperclip className={cn(iconSize, "mr-0.5")} />
            {triggerLabel}
          </Button>
        }
      />
      <PopoverContent align="end" side="bottom" className="w-80">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Adjuntar comprobante</p>
            <p className="text-xs text-muted-foreground">
              Sube una imagen o PDF del comprobante de pago.
            </p>
          </div>
          <ReceiptUpload onFileSelect={setFile} />
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!file || isUploading}
            >
              {isUploading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {isUploading ? "Subiendo..." : "Subir"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
