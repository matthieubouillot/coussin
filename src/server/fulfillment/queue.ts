import "server-only";
import { after } from "next/server";
import { Client } from "@upstash/qstash";
import { env } from "@/server/env";
import { fulfillOrder } from "@/server/fulfillment/dispatch";

/**
 * Déclenche (ou programme) le traitement fournisseur d'une commande.
 * En ligne : QStash appelle /api/jobs/fulfill (avec réessais côté QStash en cas de panne).
 * En dev sans QStash : exécution juste après la réponse HTTP ; les tentatives différées sont reprises
 * par le cron de rattrapage. Dans tous les cas, l'état fait foi en base : un déclenchement en
 * trop ne fait rien.
 */
export async function scheduleFulfillment(orderId: string, at: Date | null = null): Promise<void> {
  const token = env().QSTASH_TOKEN;
  if (token) {
    const client = new Client({ token });
    await client.publishJSON({
      url: `${env().NEXT_PUBLIC_SITE_URL}/api/jobs/fulfill`,
      body: { orderId },
      notBefore: at ? Math.ceil(at.getTime() / 1000) : undefined,
      deduplicationId: `fulfill-${orderId}-${at ? at.getTime() : "now"}`,
      retries: 3,
    });
    return;
  }
  if (!at) {
    try {
      after(async () => {
        try {
          await fulfillOrder(orderId);
        } catch (error) {
          console.error("Traitement fournisseur en échec", orderId, (error as Error).message);
        }
      });
    } catch {
      // Hors requête HTTP (script, test) : le cron de rattrapage prendra la commande sous 10 minutes.
    }
  }
}
