import { Receiver } from "@upstash/qstash";
import { z } from "zod";
import { env } from "@/server/env";
import { fulfillOrder } from "@/server/fulfillment/dispatch";
import { scheduleFulfillment } from "@/server/fulfillment/queue";

// Job QStash : la signature est vérifiée sur le corps brut, toute autre requête est rejetée.
export async function POST(request: Request): Promise<Response> {
  const { QSTASH_CURRENT_SIGNING_KEY: current, QSTASH_NEXT_SIGNING_KEY: next } = env();
  const signature = request.headers.get("upstash-signature");
  if (!current || !next || !signature) return new Response("Non autorisé", { status: 401 });

  const body = await request.text();
  const receiver = new Receiver({ currentSigningKey: current, nextSigningKey: next });
  const valid = await receiver
    .verify({ signature, body, url: `${env().NEXT_PUBLIC_SITE_URL}/api/jobs/fulfill` })
    .catch(() => false);
  if (!valid) return new Response("Signature invalide", { status: 401 });

  const parsed = z.object({ orderId: z.string().min(1).max(64) }).safeParse(JSON.parse(body));
  if (!parsed.success) return new Response("Requête invalide", { status: 400 });

  const { nextRunAt } = await fulfillOrder(parsed.data.orderId);
  if (nextRunAt) await scheduleFulfillment(parsed.data.orderId, nextRunAt);
  return Response.json({ ok: true, nextRunAt });
}
