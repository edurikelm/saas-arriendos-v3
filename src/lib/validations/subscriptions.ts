import { z } from "zod";

export const cancelSubscriptionSchema = z.object({
  reason: z
    .enum(["too_expensive", "not_using", "switching_provider", "other"])
    .optional(),
});

export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;

export const adminCancelSubscriptionSchema = z.object({
  userId: z.string().cuid(),
  reason: z.string().trim().min(1).max(500),
});

export type AdminCancelSubscriptionInput = z.infer<
  typeof adminCancelSubscriptionSchema
>;
