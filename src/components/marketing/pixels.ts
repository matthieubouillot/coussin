"use client";

import { META_EVENT_NAMES, TIKTOK_EVENT_NAMES, type MarketingEvent } from "@/lib/marketing/events";

/**
 * Chargement des pixels et envoi des événements côté navigateur.
 * Appelé UNIQUEMENT après consentement (voir MarketingProvider). Les scripts des régies sont
 * insérés par notre code (autorisé par la CSP via 'strict-dynamic'), jamais en dur dans la page.
 */

type Queue = ((...args: unknown[]) => void) & { queue?: unknown[][]; push?: unknown };

declare global {
  interface Window {
    ttq?: {
      load: (id: string) => void;
      page: () => void;
      track: (event: string, props: unknown, options: unknown) => void;
      _q?: unknown[][];
    };
    fbq?: Queue;
    _fbq?: Queue;
  }
}

function injectScript(src: string): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/**
 * Transcription du code d'installation officiel du pixel TikTok : file d'attente des appels,
 * puis chargement de events.js qui la rejoue.
 */
export function loadTikTokPixel(pixelId: string): void {
  if (window.ttq) return;
  type Ttq = unknown[] & Record<string, unknown>;
  const w = window as unknown as { TiktokAnalyticsObject: string; ttq: Ttq };
  w.TiktokAnalyticsObject = "ttq";
  const ttq: Ttq = (w.ttq = w.ttq || ([] as unknown as Ttq));
  const methods = [
    "page",
    "track",
    "identify",
    "instances",
    "debug",
    "on",
    "off",
    "once",
    "ready",
    "alias",
    "group",
    "enableCookie",
    "disableCookie",
    "holdConsent",
    "revokeConsent",
    "grantConsent",
  ];
  ttq.methods = methods;
  const setAndDefer = (target: Ttq, method: string) => {
    target[method] = (...args: unknown[]) => target.push([method, ...args]);
  };
  for (const m of methods) setAndDefer(ttq, m);
  ttq.instance = (id: string) => {
    const instance = ((ttq._i as Record<string, Ttq>)[id] ?? []) as Ttq;
    for (const m of methods) setAndDefer(instance, m);
    return instance;
  };
  ttq.load = (id: string) => {
    const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = (ttq._i as Record<string, unknown>) ?? {};
    (ttq._i as Record<string, unknown>)[id] = Object.assign([], { _u: url });
    ttq._t = (ttq._t as Record<string, number>) ?? {};
    (ttq._t as Record<string, number>)[id] = Date.now();
    ttq._o = (ttq._o as Record<string, unknown>) ?? {};
    (ttq._o as Record<string, unknown>)[id] = {};
    injectScript(`${url}?sdkid=${encodeURIComponent(id)}&lib=ttq`);
  };
  (ttq.load as (id: string) => void)(pixelId);
  (ttq.page as () => void)();
}

export function loadMetaPixel(pixelId: string): void {
  if (window.fbq) return;
  const fbq: Queue = (...args: unknown[]) => {
    fbq.queue!.push(args);
  };
  fbq.queue = [];
  fbq.push = fbq;
  Object.assign(fbq, { loaded: true, version: "2.0" });
  window.fbq = fbq;
  window._fbq = fbq;
  injectScript("https://connect.facebook.net/en_US/fbevents.js");
  fbq("init", pixelId);
  fbq("track", "PageView");
}

export function trackInBrowser(event: MarketingEvent): void {
  const value = event.valueCents / 100;
  window.ttq?.track(
    TIKTOK_EVENT_NAMES[event.name],
    {
      currency: "EUR",
      value,
      content_type: "product",
      contents: event.contents.map((c) => ({
        content_id: c.id,
        content_name: c.name,
        quantity: c.quantity,
        price: c.priceCents / 100,
      })),
    },
    { event_id: event.eventId },
  );
  window.fbq?.(
    "track",
    META_EVENT_NAMES[event.name],
    {
      currency: "EUR",
      value,
      content_type: "product",
      contents: event.contents.map((c) => ({ id: c.id, quantity: c.quantity })),
    },
    { eventID: event.eventId },
  );
}

/** Retrait du consentement : les cookies déposés par les régies sur notre domaine sont effacés. */
export function clearAdCookies(): void {
  for (const name of ["_ttp", "_tt_enable_cookie", "ttcsid", "_fbp", "_fbc"]) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.${location.hostname}`;
  }
}
