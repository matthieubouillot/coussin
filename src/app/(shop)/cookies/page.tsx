import type { Metadata } from "next";
import { ManageCookiesButton } from "@/components/consent/ManageCookiesButton";
import { LegalPage } from "@/components/shop/LegalPage";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Politique cookies" };

// Liste à revérifier en conditions réelles (outils de développement du navigateur) après activation des pixels.
export default async function Cookies() {
  const settings = await db.shopSettings.findUnique({
    where: { id: "singleton" },
    select: { metaEnabled: true },
  });
  const metaEnabled = settings?.metaEnabled ?? false;
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

      <h2>Cookies soumis à votre consentement (finalité « Publicité et mesure des campagnes »)</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Déposé par</th>
            <th scope="col">Finalité</th>
            <th scope="col">Durée</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>attribution</td>
            <td>Ce site</td>
            <td>Mémoriser la publicité qui vous a amené (paramètres utm, identifiant de clic)</td>
            <td>30 jours</td>
          </tr>
          <tr>
            <td>_ttp, _tt_enable_cookie, ttcsid</td>
            <td>TikTok</td>
            <td>Mesurer l&apos;efficacité des publicités TikTok et vous proposer des annonces pertinentes</td>
            <td>Jusqu&apos;à 13 mois</td>
          </tr>
          {metaEnabled && (
            <tr>
              <td>_fbp, _fbc</td>
              <td>Meta</td>
              <td>Mesurer l&apos;efficacité des publicités Facebook / Instagram</td>
              <td>90 jours</td>
            </tr>
          )}
        </tbody>
      </table>
      <p>
        Avec votre accord, les mêmes événements (consultation du produit, ajout au panier, début de paiement,
        achat) sont aussi transmis directement par notre serveur à TikTok{metaEnabled ? " et à Meta" : ""},
        avec votre adresse email et votre téléphone sous forme hachée (illisible), votre adresse IP et votre
        navigateur. Sans votre accord, rien n&apos;est transmis.
      </p>
      <p>
        Ces cookies ne sont jamais déposés avant votre accord. Refuser est aussi simple qu&apos;accepter et
        n&apos;affecte en rien votre possibilité de commander. Votre choix est conservé 6 mois, puis vous est
        redemandé.
      </p>
    </LegalPage>
  );
}
