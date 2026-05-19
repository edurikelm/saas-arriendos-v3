import { z } from "zod";

export const fileSchema = z.object({
  size: z.number().max(5 * 1024 * 1024, "El archivo no puede superar los 5MB"),
  type: z.enum(["image/jpeg", "image/png", "image/webp"], { message: "Solo se permiten imágenes JPEG, PNG o WebP" }),
});

export type FileValidation = z.infer<typeof fileSchema>;
