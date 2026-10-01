"use client";

import { OPEN_CONSENT_EVENT } from "@/components/consent/CookieConsent";

export function ManageCookiesButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className="underline-offset-4 hover:underline"
    >
      Gérer mes cookies
    </button>
  );
}
