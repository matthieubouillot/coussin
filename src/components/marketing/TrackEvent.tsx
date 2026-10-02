"use client";

import { useEffect, useRef } from "react";
import type { MarketingEvent } from "@/lib/marketing/events";
import { useMarketing } from "./MarketingProvider";

/** Envoie un événement une fois à l'affichage (ViewContent, Purchase). Sans consentement : rien. */
export function TrackEvent({
  event,
}: {
  event: Omit<MarketingEvent, "eventId" | "pageUrl"> & { eventId?: string };
}) {
  const { track } = useMarketing();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(event);
  }, [event, track]);
  return null;
}
