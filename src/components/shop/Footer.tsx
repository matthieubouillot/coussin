import Link from "next/link";
import { ManageCookiesButton } from "@/components/consent/ManageCookiesButton";

const LEGAL_LINKS = [
  { href: "/contact", label: "Contact" },
  { href: "/suivi", label: "Suivre ma commande" },
  { href: "/retractation", label: "Rétractation" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgv", label: "Conditions générales de vente" },
  { href: "/confidentialite", label: "Politique de confidentialité" },
  { href: "/cookies", label: "Politique cookies" },
  { href: "/avis-clients", label: "Nos avis clients" },
];

export function Footer({ shopName, vatExempt }: { shopName: string; vatExempt: boolean }) {
  return (
    <footer className="border-cocoa/10 mt-16 border-t bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm">
        <nav aria-label="Aide et informations légales">
          <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="underline-offset-4 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <ManageCookiesButton />
            </li>
          </ul>
        </nav>
        <p className="text-ink/70 mt-6">
          {shopName} · Paiement sécurisé par Stripe
          {vatExempt && " · TVA non applicable, art. 293 B du CGI"}
        </p>
      </div>
    </footer>
  );
}
