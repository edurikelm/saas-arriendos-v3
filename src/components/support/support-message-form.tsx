"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addSupportTicketMessage, closeSupportTicket } from "@/lib/actions/support";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SupportImageUpload } from "./support-image-upload";
import type { AttachmentInput } from "@/lib/validations/support";

interface SupportMessageFormProps {
  ticketId: string;
  canAddMessage: boolean;
  canClose: boolean;
}

export function SupportMessageForm({ ticketId, canAddMessage, canClose }: SupportMessageFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<AttachmentInput[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(form);
    const content = formData.get("content") as string;

    const result = await addSupportTicketMessage(ticketId, content, images.length > 0 ? images : undefined);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }

    form.reset();
    setImages([]);
    setIsSubmitting(false);
    router.refresh();
  }

  async function handleClose() {
    setIsClosing(true);
    setError(null);

    const result = await closeSupportTicket(ticketId);

    if (result.error) {
      setError(result.error);
      setIsClosing(false);
      return;
    }

    setIsClosing(false);
    router.refresh();
  }

  return (
    <div className="space-y-4 pt-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {canAddMessage && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            name="content"
            placeholder="Escribe tu mensaje..."
            required
            minLength={1}
            maxLength={2000}
            rows={4}
          />
          <SupportImageUpload images={images} onChange={setImages} onUploadingChange={setUploading} />
          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting || uploading}>
              {isSubmitting ? "Enviando..." : "Enviar Mensaje"}
            </Button>
          </div>
        </form>
      )}

      {canClose && (
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={isClosing}
            onClick={handleClose}
          >
            {isClosing ? "Cerrando..." : "Cerrar Ticket"}
          </Button>
        </div>
      )}
    </div>
  );
}
