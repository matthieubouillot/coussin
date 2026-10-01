import type { Metadata } from "next";
import { headers } from "next/headers";
import { turnstileSiteKey } from "@/server/security/turnstile";
import { WithdrawalForm } from "./WithdrawalForm";

export const metadata: Metadata = { title: "Droit de rétractation" };

export default async function WithdrawalPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-cocoa font-serif text-3xl">Exercer mon droit de rétractation</h1>
      <p className="mt-3">
        Vous disposez de 14 jours à compter de la réception de votre commande pour vous rétracter, sans avoir
        à vous justifier. Les frais de retour sont à votre charge. Conditions détaillées dans nos{" "}
        <a href="/cgv" className="underline">
          CGV
        </a>
        .
      </p>
      <p className="mt-3">
        Vous pouvez aussi utiliser le{" "}
        <a href="/retractation/formulaire" className="underline" download>
          modèle de formulaire de rétractation (PDF)
        </a>{" "}
        et nous l&apos;envoyer par email.
      </p>
      <WithdrawalForm siteKey={turnstileSiteKey()} nonce={nonce} />
    </main>
  );
}
