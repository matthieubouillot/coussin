"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/audit/audit";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import { cancelOrder, RefundError, refundOrder } from "@/server/orders/refunds";

export type ActionState = { ok: boolean; message: string } | null;

const idSchema = z.string().min(1).max(64);
const euros = z
  .string()
  .trim()
  .regex(/^\d{1,6}([.,]\d{1,2})?$/, "Montant invalide (ex. 29,90)")
  .transform((v) => Math.round(Number(v.replace(",", ".")) * 100));

function failure(error: unknown): ActionState {
  if (error instanceof RefundError) return { ok: false, message: error.message };
  console.error("Action commande en échec", error instanceof Error ? error.message : error);
  return {
    ok: false,
    message: "L'opération a échoué. Rien n'a été remboursé deux fois ; réessayez ou vérifiez dans Stripe.",
  };
}

export async function refundAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ orderId: idSchema, amount: euros, reason: z.string().trim().min(3).max(200) })
    .safeParse({
      orderId: formData.get("orderId"),
      amount: formData.get("amount"),
      reason: formData.get("reason"),
    });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  try {
    const result = await refundOrder({
      orderId: parsed.data.orderId,
      amountCents: parsed.data.amount,
      reason: parsed.data.reason,
      adminId: admin.id,
    });
    revalidatePath("/admin/commandes");
    return {
      ok: true,
      message: `Remboursement effectué, avoir ${result.creditNoteNumber} émis et envoyé au client.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ orderId: idSchema, reason: z.string().trim().min(3).max(200), confirm: z.literal("on") })
    .safeParse({
      orderId: formData.get("orderId"),
      reason: formData.get("reason"),
      confirm: formData.get("confirm"),
    });
  if (!parsed.success) return { ok: false, message: "Indiquez un motif et cochez la confirmation." };
  try {
    await cancelOrder({ orderId: parsed.data.orderId, reason: parsed.data.reason, adminId: admin.id });
    revalidatePath("/admin/commandes");
    return { ok: true, message: "Commande annulée (et remboursée si elle était payée)." };
  } catch (error) {
    return failure(error);
  }
}

export async function addNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ orderId: idSchema, body: z.string().trim().min(1).max(2000) })
    .safeParse({ orderId: formData.get("orderId"), body: formData.get("body") });
  if (!parsed.success) return { ok: false, message: "Note vide." };
  await db.orderNote.create({
    data: { orderId: parsed.data.orderId, authorId: admin.id, body: parsed.data.body },
  });
  await audit("order.note", { actorId: admin.id, targetType: "order", targetId: parsed.data.orderId });
  revalidatePath("/admin/commandes");
  return { ok: true, message: "Note ajoutée." };
}

export async function updateWithdrawalAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ id: idSchema, status: z.enum(["ACCEPTED", "RETURN_RECEIVED", "REJECTED"]) })
    .safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return;
  const request = await db.withdrawalRequest.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });
  await audit("withdrawal.update", {
    actorId: admin.id,
    targetType: "order",
    targetId: request.orderId,
    metadata: { status: parsed.data.status },
  });
  revalidatePath("/admin/commandes");
}
