import { z } from "zod";

/** Structure des contenus éditoriaux du produit (Product.contentBlocks), éditée dans l'admin. */
export const productContentSchema = z.object({
  howItWorks: z.object({ title: z.string(), paragraphs: z.array(z.string()).min(1) }),
  benefits: z.array(z.object({ title: z.string(), text: z.string() })).min(1),
  care: z.array(z.string()),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })),
  guarantees: z.array(z.object({ title: z.string(), text: z.string() })),
});

export type ProductContent = z.infer<typeof productContentSchema>;

export const sizeGuideSchema = z.object({
  rows: z
    .array(
      z.object({
        size: z.string(),
        dimensions: z.string(),
        animal: z.string(),
        weight: z.string(),
      }),
    )
    .min(1),
  note: z.string().optional(),
});

export type SizeGuide = z.infer<typeof sizeGuideSchema>;
