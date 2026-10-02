import { createHash } from "node:crypto";
import { META_EVENT_NAMES, TIKTOK_EVENT_NAMES, type MarketingEvent } from "@/lib/marketing/events";

/** Construction des messages envoyés aux régies (fonctions pures, testées). */

export type AdContext = {
  ttp?: string | null;
  ttclid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type Identity = { email?: string | null; phone?: string | null; externalId?: string | null };

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizedHashes(identity: Identity) {
  const email = identity.email?.trim().toLowerCase();
  // Téléphone au format E.164 sans « + » pour Meta, avec « + » pour TikTok.
  const phone = identity.phone?.replace(/[^\d+]/g, "");
  return {
    email: email ? sha256(email) : undefined,
    phoneE164: phone ? sha256(phone.startsWith("+") ? phone : `+${phone}`) : undefined,
    phoneDigits: phone ? sha256(phone.replace(/^\+/, "")) : undefined,
    externalId: identity.externalId ? sha256(identity.externalId) : undefined,
  };
}

export function tiktokPayload(
  pixelId: string,
  event: MarketingEvent,
  context: AdContext,
  identity: Identity,
) {
  const hashes = normalizedHashes(identity);
  return {
    event_source: "web",
    event_source_id: pixelId,
    data: [
      {
        event: TIKTOK_EVENT_NAMES[event.name],
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        user: {
          email: hashes.email,
          phone: hashes.phoneE164,
          external_id: hashes.externalId,
          ttclid: context.ttclid ?? undefined,
          ttp: context.ttp ?? undefined,
          ip: context.ip ?? undefined,
          user_agent: context.userAgent ?? undefined,
        },
        page: event.pageUrl ? { url: event.pageUrl } : undefined,
        properties: {
          currency: "EUR",
          value: event.valueCents / 100,
          content_type: "product",
          contents: event.contents.map((c) => ({
            content_id: c.id,
            content_name: c.name,
            quantity: c.quantity,
            price: c.priceCents / 100,
          })),
        },
      },
    ],
  };
}

export function metaPayload(event: MarketingEvent, context: AdContext, identity: Identity) {
  const hashes = normalizedHashes(identity);
  return {
    data: [
      {
        event_name: META_EVENT_NAMES[event.name],
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: event.pageUrl,
        user_data: {
          em: hashes.email ? [hashes.email] : undefined,
          ph: hashes.phoneDigits ? [hashes.phoneDigits] : undefined,
          external_id: hashes.externalId ? [hashes.externalId] : undefined,
          fbp: context.fbp ?? undefined,
          fbc: context.fbc ?? undefined,
          client_ip_address: context.ip ?? undefined,
          client_user_agent: context.userAgent ?? undefined,
        },
        custom_data: {
          currency: "EUR",
          value: event.valueCents / 100,
          content_type: "product",
          contents: event.contents.map((c) => ({
            id: c.id,
            quantity: c.quantity,
            item_price: c.priceCents / 100,
          })),
        },
      },
    ],
  };
}
