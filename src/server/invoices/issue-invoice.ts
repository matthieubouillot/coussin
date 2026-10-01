import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import {
  buildInvoiceLines,
  customerSnapshotSchema,
  formatInvoiceNumber,
  invoiceLineSchema,
  sellerSnapshotSchema,
  VAT_EXEMPT_MENTION,
} from "@/server/invoices/invoice-data";
import { renderInvoicePdf } from "@/server/invoices/invoice-pdf";
import { getShopConfig } from "@/server/settings/settings";
import { getPrivateFile, putPrivateFile } from "@/server/storage/private-files";

/**
 * Émission de facture — à appeler DANS la transaction qui marque la commande payée.
 *
 * Numérotation chronologique continue sans trou : le compteur de la série est incrémenté dans la
 * même transaction que la création de la facture. Postgres verrouille la ligne du compteur jusqu'au
 * commit : deux paiements simultanés obtiennent deux numéros consécutifs, et une transaction
 * annulée n'en consomme aucun.
 */
export async function issueInvoiceInTx(tx: Prisma.TransactionClient, orderId: string): Promise<string> {
  const existing = await tx.invoice.findFirst({ where: { orderId, type: "INVOICE" }, select: { id: true } });
  if (existing) return existing.id;

  const [order, settings, config] = await Promise.all([
    tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, promoCode: true } }),
    tx.shopSettings.findUnique({ where: { id: "singleton" }, select: { invoicePrefix: true } }),
    getShopConfig(),
  ]);

  const series = settings?.invoicePrefix ?? "BTQ";
  const sequence = await tx.invoiceSequence.upsert({
    where: { series },
    create: { series, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  const seller = sellerSnapshotSchema.parse({
    shopName: config.shopName,
    sellerName: config.legal.sellerName,
    legalStatus: config.legal.legalStatus,
    siret: config.legal.siret,
    address: config.legal.address,
    email: config.legal.email,
  });
  const customer = customerSnapshotSchema.parse({
    name: order.shippingName ?? "",
    email: order.email,
    addressLines: [
      order.shippingLine1,
      order.shippingLine2,
      [order.shippingPostalCode, order.shippingCity].filter(Boolean).join(" "),
      "France",
    ].filter((l): l is string => Boolean(l)),
  });
  const lines = buildInvoiceLines({ ...order, promoCode: order.promoCode?.code ?? null });

  const sum = lines.reduce((s, l) => s + l.totalCents, 0);
  if (sum !== order.totalCents) {
    throw new Error(
      `Facture de la commande ${order.number} : lignes (${sum}) ≠ total payé (${order.totalCents})`,
    );
  }

  const invoice = await tx.invoice.create({
    data: {
      type: "INVOICE",
      number: formatInvoiceNumber(series, sequence.lastNumber),
      orderId,
      issuedAt: order.paidAt ?? new Date(),
      sellerSnapshot: seller,
      customerSnapshot: customer,
      lines,
      totalCents: order.totalCents,
      taxCents: order.taxCents,
      legalMention: order.taxMode === "FRANCHISE_293B" ? VAT_EXEMPT_MENTION : "",
    },
  });
  return invoice.id;
}

/**
 * Génère et stocke le PDF d'une facture déjà émise (hors transaction, idempotent).
 * Le PDF est entièrement dérivé des snapshots : le régénérer après un échec donne le même contenu.
 */
export async function ensureInvoicePdf(invoiceId: string): Promise<{ key: string; bytes: Buffer }> {
  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { order: { select: { number: true, paidAt: true, paymentMethodType: true } } },
  });

  if (invoice.pdfStorageKey) {
    const stored = await getPrivateFile(invoice.pdfStorageKey);
    if (!stored) throw new Error(`PDF de la facture ${invoice.number} introuvable dans le stockage`);
    return { key: invoice.pdfStorageKey, bytes: stored };
  }

  let bytes = await renderInvoicePdf({
    number: invoice.number,
    issuedAt: invoice.issuedAt,
    orderNumber: invoice.order.number,
    paidAt: invoice.order.paidAt,
    paymentMethodType: invoice.order.paymentMethodType,
    seller: sellerSnapshotSchema.parse(invoice.sellerSnapshot),
    customer: customerSnapshotSchema.parse(invoice.customerSnapshot),
    lines: invoiceLineSchema.array().parse(invoice.lines),
    totalCents: invoice.totalCents,
    taxCents: invoice.taxCents,
    legalMention: invoice.legalMention,
  });

  // L'identifiant unique évite toute collision avec un fichier d'une autre base (restauration, dev).
  const key = `factures/${invoice.number}-${invoice.id}.pdf`;
  try {
    await putPrivateFile(key, bytes, "application/pdf");
  } catch (error) {
    // Un essai précédent a pu stocker le fichier sans enregistrer la clé : c'est lui qui fait foi.
    const stored = await getPrivateFile(key);
    if (!stored) throw error;
    bytes = stored;
  }
  await db.invoice.update({
    where: { id: invoiceId },
    data: { pdfStorageKey: key, pdfSha256: createHash("sha256").update(bytes).digest("hex") },
  });
  return { key, bytes };
}
