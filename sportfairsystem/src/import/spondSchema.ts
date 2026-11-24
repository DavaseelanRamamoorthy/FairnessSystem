import { z } from "zod";

/**
 * Snapshot of one Spond event's responses, taken at the availability deadline.
 * Claude writes this from the Spond page (or it is built from a Spond export).
 */
export const spondSnapshotSchema = z.object({
  source: z.literal("spond"),
  event_title: z.string().min(1),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  spond_event_ref: z.string().optional(),
  captured_at: z.string().datetime({ offset: true }),
  responses: z
    .array(
      z.object({
        name: z.string().min(1),
        answer: z.enum(["yes", "no", "maybe", "unanswered"])
      })
    )
    .min(1)
});

export type SpondSnapshot = z.infer<typeof spondSnapshotSchema>;
