import type { Metadata } from "next";
import { ManageCookiesButton } from "@/components/consent/ManageCookiesButton";
import { LegalPage } from "@/components/shop/LegalPage";

export const metadata: Metadata = { title: "Politique cookies" };

// À compléter en phase 6 avec la liste exacte des cookies déposés par le pixel TikTok.
export default function Cookies() {
  return (
    <LegalPage title="Politique cookies" updatedAt="1er octobre 2026">
      <p>
        Un cookie est un petit fichier déposé sur votre appareil lors de la visite d&apos;un site. Certains
        sont indispensables au fonctionnement du site ; les autres ne sont déposés qu&apos;avec votre accord.
      </p>
      <p>
        <ManageCookiesButton />
      </p>

      <h2>Cookies indispensables (sans consentement)</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Finalité</th>
            <th scope="col">Durée</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>panier</td>
            <td>Mémoriser le contenu de votre panier (tailles et quantités, sans donnée personnelle)</td>
            <td>30 jours</td>
          </tr>
          <tr>
            <td>consentement</td>
            <td>Mémoriser vos choix en matière de cookies</td>
            <td>6 mois</td>
          </tr>
        </tbody>
      </table>
      <p>
        Lors de l&apos;envoi d&apos;un formulaire (contact, suivi de commande), un service anti-robot
        (Cloudflare Turnstile) peut analyser des données techniques de votre navigateur afin de protéger le
        site contre les abus. Ce traitement relève de la sécurité du site.
      </p>

      <h2>Cookies soumis à votre consentement</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Finalité</th>
            <th scope="col">Partenaire</th>
            <th scope="col">Durée</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Publicité et mesure des campagnes</td>
            <td>TikTok (Meta s&apos;il est activé)</td>
            <td>13 mois maximum ; liste détaillée publiée avant activation</td>
          </tr>
        </tbody>
      </table>
      <p>
        Ces cookies ne sont jamais déposés avant votre accord. Refuser est aussi simple qu&apos;accepter et
        n&apos;affecte en rien votre possibilité de commander. Votre choix est conservé 6 mois, puis vous est
        redemandé.
      </p>
    </LegalPage>
  );
}
