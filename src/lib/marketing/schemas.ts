import { z } from "zod";
import { ATTRIBUTION_PARAMS, MARKETING_EVENTS } from "@/lib/marketing/events";

// Validation côté serveur des événements et de la provenance (Zod n'est pas envoyé au navigateur).

export const marketingEventSchema = z.object({
  name: z.enum(MARKETING_EVENTS),
  eventId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
  /** Montant TTC en centimes. */
  valueCents: z.int().min(0).max(10_000_000),
  contents: z
    .array(
      z.object({
        id: z.string().max(64),
        name: z.string().max(200),
        quantity: z.int().min(1).max(100),
        priceCents: z.int().min(0),
      }),
    )
    .max(20),
  pageUrl: z.url().optional(),
});

export const attributionSchema = z
  .object(
    Object.fromEntries(ATTRIBUTION_PARAMS.map((k) => [k, z.string().max(200).optional()])) as Record<
      (typeof ATTRIBUTION_PARAMS)[number],
      z.ZodOptional<z.ZodString>
    >,
  )
  .partial();
