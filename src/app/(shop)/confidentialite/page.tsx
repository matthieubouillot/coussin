import type { Metadata } from "next";
import { Info, LegalPage } from "@/components/shop/LegalPage";
import { getShopConfig } from "@/server/settings/settings";

export const metadata: Metadata = { title: "Politique de confidentialité" };

// Modèle à faire relire. Toute évolution des traitements (nouveau prestataire, nouvelle finalité)
// doit être reportée ici et dans docs/RGPD.md.

const PROCESSORS: { name: string; role: string; location: string }[] = [
  {
    name: "Stripe",
    role: "Paiement en ligne, prévention de la fraude",
    location: "UE et États-Unis (Data Privacy Framework, clauses contractuelles types)",
  },
  {
    name: "Vercel",
    role: "Hébergement du site",
    location: "Fonctions en UE (Francfort) ; société américaine (Data Privacy Framework)",
  },
  { name: "Neon", role: "Base de données", location: "UE (Francfort)" },
  {
    name: "Resend",
    role: "Envoi des emails transactionnels",
    location: "États-Unis (clauses contractuelles types)",
  },
  { name: "Sentry", role: "Détection des erreurs techniques (sans données personnelles)", location: "UE" },
  { name: "Upstash", role: "Limitation anti-abus, files de traitement", location: "UE" },
  {
    name: "Cloudflare (Turnstile)",
    role: "Protection anti-robot des formulaires",
    location: "UE et États-Unis (Data Privacy Framework)",
  },
];

export default async function Confidentialite() {
  const { legal } = await getShopConfig();
  return (
    <LegalPage title="Politique de confidentialité" updatedAt="1er octobre 2026">
      <h2>Responsable du traitement</h2>
      <p>
        <Info>{legal.sellerName}</Info>, {legal.legalStatus}, <Info>{legal.address}</Info>. Contact pour toute
        question relative à vos données : <Info>{legal.email}</Info>.
      </p>

      <h2>Données collectées et finalités</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Finalité</th>
            <th scope="col">Données</th>
            <th scope="col">Base légale</th>
            <th scope="col">Durée de conservation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Traitement et livraison de la commande, service client, garanties</td>
            <td>Nom, email, téléphone, adresse de livraison, contenu de la commande</td>
            <td>Exécution du contrat</td>
            <td>Durée de la relation commerciale, puis 3 ans après le dernier contact</td>
          </tr>
          <tr>
            <td>Facturation et comptabilité</td>
            <td>Factures, montants, date et mode de paiement (jamais les numéros de carte)</td>
            <td>Obligation légale</td>
            <td>10 ans (article L123-22 du Code de commerce)</td>
          </tr>
          <tr>
            <td>Demande d&apos;avis après livraison et publication des avis</td>
            <td>Email, prénom et initiale du nom, note et commentaire</td>
            <td>Intérêt légitime (vous pouvez vous y opposer à tout moment)</td>
            <td>Avis : tant qu&apos;il est publié ; invitation : 3 ans</td>
          </tr>
          <tr>
            <td>Réponse aux messages du formulaire de contact</td>
            <td>Nom, email, message, numéro de commande éventuel</td>
            <td>Intérêt légitime</td>
            <td>1 an</td>
          </tr>
          <tr>
            <td>Sécurité du site, prévention des abus et de la fraude</td>
            <td>Données techniques, adresse IP sous forme hachée</td>
            <td>Intérêt légitime</td>
            <td>30 jours (journaux techniques)</td>
          </tr>
          <tr>
            <td>Mesure de l&apos;efficacité de nos publicités</td>
            <td>Pages vues, ajouts au panier, achats, identifiants publicitaires</td>
            <td>Consentement (bandeau cookies)</td>
            <td>Choix mémorisé 6 mois ; voir la politique cookies</td>
          </tr>
        </tbody>
      </table>
      <p>
        Nous ne collectons que les données nécessaires à ces finalités. Nous ne vendons pas vos données.
        Aucune décision automatisée produisant des effets juridiques n&apos;est prise à votre égard.
      </p>

      <h2>Destinataires et sous-traitants</h2>
      <p>
        Vos données sont accessibles uniquement au Vendeur et aux prestataires suivants, liés par des
        engagements de confidentialité et de sécurité :
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Prestataire</th>
            <th scope="col">Rôle</th>
            <th scope="col">Localisation / garanties</th>
          </tr>
        </thead>
        <tbody>
          {PROCESSORS.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td>{p.role}</td>
              <td>{p.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Fournisseurs et transporteurs</h3>
      <p>
        Nos produits sont expédiés directement par nos fournisseurs. Pour livrer votre commande, votre nom,
        votre adresse de livraison et votre numéro de téléphone sont transmis au fournisseur qui
        l&apos;expédie (notamment AliExpress ou CJ Dropshipping, établis en <strong>Chine</strong>) et au
        transporteur chargé de la livraison. Ce transfert hors de l&apos;Union européenne est nécessaire à
        l&apos;exécution du contrat que vous concluez avec nous (article 49, paragraphe 1, b du RGPD) ; seules
        les données indispensables à la livraison sont transmises.
      </p>
      <h3>Partenaires publicitaires</h3>
      <p>
        Uniquement si vous l&apos;acceptez, TikTok (et Meta s&apos;il est activé) reçoivent des informations
        sur votre navigation et vos achats afin de mesurer nos campagnes. Voir la{" "}
        <a href="/cookies">politique cookies</a>.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;effacement, de limitation,
        d&apos;opposition et de portabilité de vos données, ainsi que du droit de définir des directives
        relatives à leur sort après votre décès. Vous pouvez retirer votre consentement à tout moment via le
        lien « Gérer mes cookies ». Écrivez-nous à <Info>{legal.email}</Info> ; nous répondons dans un délai
        d&apos;un mois.
      </p>
      <p>
        Une demande d&apos;effacement entraîne l&apos;anonymisation de vos données, à l&apos;exception des
        factures que la loi nous impose de conserver 10 ans.
      </p>
      <p>
        Si vous estimez, après nous avoir contactés, que vos droits ne sont pas respectés, vous pouvez
        adresser une réclamation à la CNIL (www.cnil.fr).
      </p>

      <h2>Sécurité</h2>
      <p>
        Les échanges avec le site sont chiffrés (HTTPS). Les paiements sont traités par Stripe : nous
        n&apos;avons jamais accès à vos données de carte. L&apos;accès à l&apos;administration de la boutique
        est protégé par une authentification à deux facteurs.
      </p>
    </LegalPage>
  );
}
