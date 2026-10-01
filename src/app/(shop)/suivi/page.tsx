import type { Metadata } from "next";
import { headers } from "next/headers";
import { turnstileSiteKey } from "@/server/security/turnstile";
import { TrackingForm } from "./TrackingForm";

export const metadata: Metadata = { title: "Suivre ma commande", robots: { index: false } };

export default async function TrackingPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-cocoa font-serif text-3xl">Suivre ma commande</h1>
      <p className="mt-2">
        Saisissez le numéro reçu dans l&apos;email de confirmation et votre adresse email.
      </p>
      <TrackingForm siteKey={turnstileSiteKey()} nonce={nonce} />
    </main>
  );
}
