import type { Metadata } from "next";
import { headers } from "next/headers";
import { turnstileSiteKey } from "@/server/security/turnstile";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-cocoa font-serif text-3xl">Nous contacter</h1>
      <p className="mt-2">Une question sur le coussin ou sur votre commande ? Écrivez-nous.</p>
      <ContactForm siteKey={turnstileSiteKey()} nonce={nonce} />
    </main>
  );
}
