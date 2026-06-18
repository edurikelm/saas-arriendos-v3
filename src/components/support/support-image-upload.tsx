"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { ImageUp, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/actions/cloudinary";
import type { AttachmentInput } from "@/lib/validations/support";

interface SupportImageUploadProps {
  images: AttachmentInput[];
  onChange: (images: AttachmentInput[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  maxImages?: number;
  maxSizeMb?: number;
}

export function SupportImageUpload({ images, onChange, onUploadingChange, maxImages = 3, maxSizeMb = 5 }: SupportImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = maxImages - images.length;
  const maxBytes = maxSizeMb * 1024 * 1024;

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of files) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast.error(`"${file.name}" no es un formato válido. Solo JPG, PNG, WebP`);
        continue;
      }
      if (file.size > maxBytes) {
        toast.error(`"${file.name}" supera los ${maxSizeMb}MB`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const toUpload = validFiles.slice(0, remaining);
    if (validFiles.length > remaining) {
      toast.error(`Máximo ${maxImages} imágenes. Se procesarán las primeras ${remaining}.`);
    }

    setUploading(true);
    try {
      const newAttachments: AttachmentInput[] = [];

      for (const file of toUpload) {
        try {
          const url = await uploadImage(file, "rentalpro/support");
          newAttachments.push({ url, fileName: file.name, fileSize: file.size });
        } catch {
          toast.error(`Error al subir "${file.name}"`);
        }
      }

      if (newAttachments.length > 0) {
        onChange([...images, ...newAttachments]);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [images, onChange, remaining, maxBytes, maxSizeMb, maxImages]);

  const handleRemove = useCallback((index: number) => {
    onChange(images.filter((_, i) => i !== index));
  }, [images, onChange]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {images.map((img, i) => (
          <div key={i} className="relative size-20 rounded-md border overflow-hidden">
            <Image
              src={img.url}
              alt={img.fileName}
              fill
              className="object-cover"
              sizes="80px"
            />
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80 transition-colors"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="size-20 rounded-md border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <ImageUp className="size-5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      {images.length > 0 && (
        <p className="text-xs text-muted-foreground">{images.length}/{maxImages} imágenes</p>
      )}
    </div>
  );
}
