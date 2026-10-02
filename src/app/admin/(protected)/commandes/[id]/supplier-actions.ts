"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eurosToCents } from "@/server/admin/form-helpers";
import { requireAdmin } from "@/server/auth/require-admin";
import {
  confirmSupplierPayment,
  recordManualDelivery,
  recordManualPlacement,
  recordManualTracking,
  relaunchFulfillment,
  retryAfterCheck,
  SupplierOperationError,
  switchToManual,
} from "@/server/fulfillment/admin-operations";

export type ActionState = { ok: boolean; message: string } | null;

const id = z.string().min(1).max(64);

async function run(fn: () => Promise<void>, success: string): Promise<ActionState> {
  try {
    await fn();
    revalidatePath("/admin/commandes");
    return { ok: true, message: success };
  } catch (error) {
    if (error instanceof SupplierOperationError) return { ok: false, message: error.message };
    console.error("Action fournisseur en échec", (error as Error).message);
    return { ok: false, message: "L'opération a échoué." };
  }
}

export async function relaunchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const orderId = id.safeParse(formData.get("orderId"));
  if (!orderId.success) return { ok: false, message: "Commande invalide." };
  return run(() => relaunchFulfillment(orderId.data, admin.id), "Traitement relancé.");
}

export async function retryAfterCheckAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ supplierOrderId: id, confirm: z.literal("on") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Confirmez d'abord avoir vérifié chez le fournisseur." };
  return run(() => retryAfterCheck(parsed.data.supplierOrderId, admin.id), "Nouvel envoi lancé.");
}

export async function switchToManualAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const soId = id.safeParse(formData.get("supplierOrderId"));
  if (!soId.success) return { ok: false, message: "Envoi invalide." };
  return run(() => switchToManual(soId.data, admin.id), "Envoi passé en traitement manuel.");
}

export async function manualPlacementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ supplierOrderId: id, externalOrderId: z.string().trim().min(1).max(100), cost: eurosToCents })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  const paid = formData.get("paid") === "on";
  return run(
    () =>
      recordManualPlacement(
        parsed.data.supplierOrderId,
        { externalOrderId: parsed.data.externalOrderId, costCents: parsed.data.cost, paid },
        admin.id,
      ),
    "Commande fournisseur enregistrée.",
  );
}

export async function confirmPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const soId = id.safeParse(formData.get("supplierOrderId"));
  if (!soId.success) return { ok: false, message: "Envoi invalide." };
  return run(() => confirmSupplierPayment(soId.data, admin.id), "Paiement fournisseur enregistré.");
}

export async function manualTrackingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      supplierOrderId: id,
      trackingNumber: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9-]{5,40}$/, "Numéro de suivi invalide"),
      carrier: z
        .string()
        .trim()
        .max(60)
        .transform((v) => v || null),
      trackingUrl: z
        .string()
        .trim()
        .max(500)
        .transform((v) => v || null)
        .pipe(z.url({ protocol: /^https$/ }).nullable()),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  const { supplierOrderId, ...tracking } = parsed.data;
  return run(
    () => recordManualTracking(supplierOrderId, tracking, admin.id),
    "Suivi enregistré, client prévenu par email.",
  );
}

export async function manualDeliveryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const soId = id.safeParse(formData.get("supplierOrderId"));
  if (!soId.success) return { ok: false, message: "Envoi invalide." };
  return run(() => recordManualDelivery(soId.data, admin.id), "Colis marqué livré.");
}
