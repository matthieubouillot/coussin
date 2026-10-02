import "server-only";
import type { MarketingEvent } from "@/lib/marketing/events";
import { db } from "@/server/db";
import { env } from "@/server/env";
import type { MarketingContext } from "@/server/marketing/context";
import { metaPayload, tiktokPayload, type Identity } from "@/server/marketing/payloads";

/**
 * Envoi serveur des événements aux régies (TikTok Events API, Meta Conversions API).
 * N'est appelé QU'AVEC le consentement publicité du client. Les données d'identification
 * (email, téléphone) sont normalisées puis hachées en SHA-256 : jamais envoyées en clair.
 * Un échec d'envoi n'interrompt jamais le parcours client (journalisé seulement).
 */

const TIKTOK_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";
const META_API_VERSION = "v26.0";

async function post(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  label: string,
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.warn(`${label} : réponse HTTP ${response.status}`);
  } catch (error) {
    console.warn(`${label} : envoi impossible (${(error as Error).name})`);
  }
}

/** Régies actives : clés présentes ET activées dans les réglages (Meta désactivé par défaut). */
export async function activeDestinations(): Promise<{ tiktok: boolean; meta: boolean }> {
  const settings = await db.shopSettings.findUnique({
    where: { id: "singleton" },
    select: { tiktokEnabled: true, metaEnabled: true },
  });
  const e = env();
  return {
    tiktok: Boolean(e.TIKTOK_PIXEL_ID && e.TIKTOK_EVENTS_API_TOKEN) && (settings?.tiktokEnabled ?? true),
    meta: Boolean(e.META_PIXEL_ID && e.META_CAPI_TOKEN) && (settings?.metaEnabled ?? false),
  };
}

export async function sendServerEvent(
  event: MarketingEvent,
  context: MarketingContext,
  identity: Identity = {},
): Promise<void> {
  const active = await activeDestinations();
  const e = env();
  const jobs: Promise<void>[] = [];
  if (active.tiktok) {
    jobs.push(
      post(
        TIKTOK_URL,
        tiktokPayload(e.TIKTOK_PIXEL_ID!, event, context, identity),
        { "Access-Token": e.TIKTOK_EVENTS_API_TOKEN! },
        "TikTok Events API",
      ),
    );
  }
  if (active.meta) {
    jobs.push(
      post(
        `https://graph.facebook.com/${META_API_VERSION}/${e.META_PIXEL_ID}/events?access_token=${encodeURIComponent(e.META_CAPI_TOKEN!)}`,
        metaPayload(event, context, identity),
        {},
        "Meta Conversions API",
      ),
    );
  }
  await Promise.all(jobs);
}
