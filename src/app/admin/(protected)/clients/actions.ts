"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/server/audit/audit";
import { requireAdmin } from "@/server/auth/require-admin";
import { anonymizeCustomer } from "@/server/gdpr/customers";

export type ActionState = { ok: boolean; message: string } | null;

export async function anonymizeCustomerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ customerId: z.string().min(1).max(64), confirm: z.literal("ANONYMISER") })
    .safeParse({ customerId: formData.get("customerId"), confirm: formData.get("confirm") });
  if (!parsed.success) return { ok: false, message: "Tapez ANONYMISER pour confirmer." };
  await anonymizeCustomer(parsed.data.customerId);
  await audit("customer.anonymize", {
    actorId: admin.id,
    targetType: "customer",
    targetId: parsed.data.customerId,
  });
  revalidatePath("/admin/clients");
  return { ok: true, message: "Client anonymisé. Les factures sont conservées (obligation légale)." };
}
