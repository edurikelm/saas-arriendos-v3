"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addSupportTicketMessage, closeSupportTicket } from "@/lib/actions/support";
import { supportAttachmentSchema } from "@/lib/validations/support";
import type { AttachmentInput } from "@/lib/validations/support";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SupportImageUpload } from "./support-image-upload";
import { toast } from "sonner";

// Local schema mirrors supportMessageSchema for resolver caching.
// Defined outside component per react-hook-form best practices.
const messageFormSchema = z.object({
  content: z
    .string()
    .min(1, "El mensaje no puede estar vacío")
    .max(2000, "El mensaje no puede exceder 2000 caracteres"),
  images: z
    .array(supportAttachmentSchema)
    .max(3, "Máximo 3 imágenes por mensaje")
    .optional(),
});

type MessageFormValues = z.infer<typeof messageFormSchema>;

interface SupportMessageFormProps {
  ticketId: string;
  canAddMessage: boolean;
  canClose: boolean;
}

export function SupportMessageForm({
  ticketId,
  canAddMessage,
  canClose,
}: SupportMessageFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: {
      content: "",
      images: undefined,
    },
    mode: "onSubmit",
    reValidateMode: "onBlur",
  });

  // Local state for non-serializable upload + UI flags
  const [images, setImages] = useState<AttachmentInput[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const onSubmit = async (values: MessageFormValues) => {
    const result = await addSupportTicketMessage(
      ticketId,
      values.content,
      images.length > 0 ? images : undefined
    );

    if (result.error) {
      toast.error(result.error);
      return;
    }

    reset();
    setImages([]);
    router.refresh();
  };

  const onInvalid = (errs: FieldErrors<MessageFormValues>) => {
    const msg = Object.values(errs)[0];
    if (msg?.message) toast.error(msg.message);
  };

  async function handleClose() {
    setIsClosing(true);
    const result = await closeSupportTicket(ticketId);
    if (result.error) {
      toast.error(result.error);
      setIsClosing(false);
      return;
    }
    setIsClosing(false);
    router.refresh();
  }

  return (
    <div className="space-y-4 pt-4">
      {canAddMessage && (
        <form
          onSubmit={handleSubmit(onSubmit, onInvalid)}
          className="space-y-3"
        >
          <div>
            <Textarea
              {...register("content")}
              placeholder="Escribe tu mensaje..."
              rows={4}
              aria-invalid={!!errors.content}
            />
            {errors.content?.message && (
              <p className="text-xs text-destructive mt-1">
                {errors.content.message}
              </p>
            )}
          </div>
          <SupportImageUpload
            images={images}
            onChange={setImages}
            onUploadingChange={setUploading}
          />
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
