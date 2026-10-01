"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: { sitekey: string; language: string; "response-field-name": string },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Widget anti-robot Cloudflare Turnstile (sans cookie publicitaire, finalité de sécurité).
 * Ajoute au formulaire un champ caché « turnstileToken », vérifié côté serveur.
 */
export function Turnstile({ siteKey, nonce }: { siteKey: string; nonce?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  function renderWidget() {
    if (!container.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      language: "fr",
      "response-field-name": "turnstileToken",
    });
  }

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        nonce={nonce}
        onReady={renderWidget}
      />
      <div ref={container} className="min-h-[65px]" />
    </>
  );
}
