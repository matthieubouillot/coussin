"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { saveAttributionAction, trackEventAction } from "@/app/marketing-actions";
import {
  ATTRIBUTION_PARAMS,
  newEventId,
  type Attribution,
  type MarketingEvent,
} from "@/lib/marketing/events";
import { loadMetaPixel, loadTikTokPixel, trackInBrowser } from "./pixels";

type Track = (event: Omit<MarketingEvent, "eventId" | "pageUrl"> & { eventId?: string }) => string;

const MarketingContext = createContext<{ track: Track; attribution: () => Attribution }>({
  track: () => "",
  attribution: () => ({}),
});

// Provenance de la visite gardée en mémoire (aucun stockage sans consentement) : transmise au
// moment de la commande, elle indique quelle publicité a amené la vente.
let attributionMemory: Attribution = {};

export function MarketingProvider({
  adsConsent,
  tiktokPixelId,
  metaPixelId,
  children,
}: {
  adsConsent: boolean;
  tiktokPixelId: string | null;
  metaPixelId: string | null;
  children: ReactNode;
}) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const found: Attribution = {};
    for (const key of ATTRIBUTION_PARAMS) {
      const value = params.get(key);
      if (value) found[key] = value.slice(0, 200);
    }
    if (Object.keys(found).length > 0) {
      attributionMemory = found;
      if (adsConsent) void saveAttributionAction(found);
    }
  }, [adsConsent]);

  useEffect(() => {
    if (!adsConsent) return;
    if (tiktokPixelId) loadTikTokPixel(tiktokPixelId);
    if (metaPixelId) loadMetaPixel(metaPixelId);
  }, [adsConsent, tiktokPixelId, metaPixelId]);

  const track = useCallback<Track>(
    (input) => {
      const event: MarketingEvent = {
        ...input,
        eventId: input.eventId ?? newEventId(),
        pageUrl: window.location.href.split("?")[0],
      };
      if (!adsConsent) return event.eventId;
      trackInBrowser(event);
      // Achat et début de paiement : le serveur envoie lui-même son double, avec le même eventId.
      if (event.name === "ViewContent" || event.name === "AddToCart") void trackEventAction(event);
      return event.eventId;
    },
    [adsConsent],
  );

  const value = useMemo(() => ({ track, attribution: () => attributionMemory }), [track]);
  return <MarketingContext.Provider value={value}>{children}</MarketingContext.Provider>;
}

export function useMarketing() {
  return useContext(MarketingContext);
}
