"use client";

import { useState, useRef, useCallback } from "react";
import { ImageUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReceiptUploadProps {
  onFileSelect: (file: File | null) => void;
  maxSizeMb?: number;
  accept?: string;
}

export function ReceiptUpload({ onFileSelect, maxSizeMb = 5, accept = "image/jpeg,image/png,image/webp" }: ReceiptUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxBytes = maxSizeMb * 1024 * 1024;

  const validateAndSet = useCallback((file: File | null) => {
    setError(null);

    if (!file) {
      setPreview(null);
      onFileSelect(null);
      return;
    }

    if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Solo se permiten imágenes JPEG, PNG o WebP");
      onFileSelect(null);
      return;
    }

    if (file.size > maxBytes) {
      setError(`La imagen no puede superar los ${maxSizeMb}MB`);
      onFileSelect(null);
      return;
    }

    setPreview(URL.createObjectURL(file));
    onFileSelect(file);
  }, [maxBytes, maxSizeMb, onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    validateAndSet(file);
  }, [validateAndSet]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    validateAndSet(file);
  }, [validateAndSet]);

  const handleRemove = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
    onFileSelect(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [preview, onFileSelect]);

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt="Preview" className="max-h-32 rounded-md border" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors",
            isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
          )}
        >
          <ImageUp className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Arrastra un comprobante o haz clic para seleccionar
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            JPEG, PNG, WebP — máx {maxSizeMb}MB
          </p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
