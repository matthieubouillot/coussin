import "server-only";
import { z } from "zod";
import { db } from "@/server/db";

export const orderLookupSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^C-[23456789A-Z]{8}$/, "Numéro de commande invalide (format C-XXXXXXXX)"),
  email: z.email("Adresse email invalide").trim().toLowerCase(),
});

/**
 * Retrouve une commande payée à partir du couple numéro + email (les deux doivent correspondre).
 * Une commande non payée n'est jamais révélée.
 */
export async function findOrderByNumberAndEmail(orderNumber: string, email: string) {
  const order = await db.order.findUnique({
    where: { number: orderNumber },
    include: {
      items: { select: { productName: true, variantLabel: true, quantity: true } },
      supplierOrders: {
        where: { trackingNumber: { not: null } },
        select: { trackingNumber: true, trackingUrl: true, carrier: true, status: true },
      },
    },
  });
  if (!order || order.email !== email || order.status === "PENDING_PAYMENT") return null;
  return order;
}
