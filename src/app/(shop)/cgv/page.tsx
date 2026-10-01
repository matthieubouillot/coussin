import type { Metadata } from "next";
import { Info, LegalPage } from "@/components/shop/LegalPage";
import { formatEuros } from "@/lib/money";
import { getActiveShippingRate } from "@/server/catalog/catalog";
import { getShopConfig } from "@/server/settings/settings";

export const metadata: Metadata = { title: "Conditions générales de vente" };

// Modèle rédigé à partir du Code de la consommation (version en vigueur au 1er octobre 2026).
// À faire relire par un juriste avant la mise en ligne (voir TODO_MATTHIEU.md).
export default async function Cgv() {
  const [{ legal, shopName, taxMode, cgvVersion }, shipping] = await Promise.all([
    getShopConfig(),
    getActiveShippingRate(),
  ]);

  return (
    <LegalPage title="Conditions générales de vente" updatedAt={`version du ${cgvVersion}`}>
      <h2>1. Vendeur</h2>
      <p>
        Les présentes conditions générales de vente (CGV) s&apos;appliquent aux ventes conclues sur le site{" "}
        <Info>{shopName}</Info> entre, d&apos;une part, <Info>{legal.sellerName}</Info>, {legal.legalStatus},
        SIRET <Info>{legal.siret}</Info>, <Info>{legal.address}</Info>, email <Info>{legal.email}</Info> (le «
        Vendeur »), et, d&apos;autre part, toute personne physique agissant à des fins non professionnelles
        (le « Client »).
      </p>
      <p>
        Le Client déclare avoir pris connaissance des présentes CGV et les avoir acceptées en cochant la case
        prévue avant de valider sa commande. Les CGV applicables sont celles en vigueur à la date de la
        commande ; elles sont jointes à l&apos;email de confirmation de commande.
      </p>

      <h2>2. Produits</h2>
      <p>
        Les caractéristiques essentielles des produits (dimensions, composition, entretien, contenu du colis)
        sont présentées sur la fiche produit. Les photographies sont aussi fidèles que possible mais ne
        peuvent assurer une similitude parfaite, notamment pour les couleurs selon l&apos;écran utilisé. Les
        produits sont proposés dans la limite des stocks disponibles ; une taille indisponible est signalée
        comme telle et ne peut pas être commandée.
      </p>

      <h2>3. Prix</h2>
      <p>
        Les prix sont indiqués en euros, toutes taxes comprises.
        {taxMode === "FRANCHISE_293B" && " TVA non applicable, article 293 B du Code général des impôts."} Les
        frais de livraison sont indiqués avant la validation de la commande
        {shipping &&
          ` : ${formatEuros(shipping.priceCents)} par commande${
            shipping.freeAboveCents !== null
              ? `, offerts dès ${formatEuros(shipping.freeAboveCents)} d'achat (après remises)`
              : ""
          }`}
        . Le prix facturé est celui affiché au moment de la validation de la commande.
      </p>
      <p>
        Lorsqu&apos;une réduction de prix est annoncée, le prix de référence barré correspond au prix le plus
        bas pratiqué au cours des 30 jours précédant la réduction (article L112-1-1 du Code de la
        consommation).
      </p>

      <h2>4. Commande</h2>
      <p>Pour passer commande, le Client :</p>
      <ol>
        <li>choisit la taille et la quantité, puis ajoute le produit au panier ;</li>
        <li>vérifie le contenu du panier, le prix total et peut corriger d&apos;éventuelles erreurs ;</li>
        <li>accepte les présentes CGV en cochant la case prévue ;</li>
        <li>
          clique sur le bouton « Commander avec obligation de paiement » puis renseigne ses coordonnées de
          livraison et de paiement sur la page sécurisée de notre prestataire de paiement.
        </li>
      </ol>
      <p>
        Le contrat est conclu à la confirmation du paiement. Le Vendeur adresse alors au Client, par email, la
        confirmation de la commande reprenant ses éléments essentiels, les présentes CGV et la facture.
      </p>
      <p>
        Le Vendeur peut refuser une commande en cas de litige antérieur relatif au paiement d&apos;une
        commande ou de suspicion de fraude ; le paiement est alors intégralement remboursé.
      </p>

      <h2>5. Paiement</h2>
      <p>
        Le paiement s&apos;effectue en ligne, au moment de la commande, par carte bancaire, Apple Pay ou
        Google Pay, via la société Stripe. Les données de paiement sont saisies sur la page sécurisée de
        Stripe : le Vendeur n&apos;y a jamais accès et ne les conserve pas. Le compte du Client est débité à
        la validation du paiement.
      </p>

      <h2>6. Livraison</h2>
      <p>
        Les produits sont livrés en France métropolitaine uniquement, à l&apos;adresse indiquée par le Client
        lors de la commande, par un transporteur avec numéro de suivi. Les produits sont expédiés directement
        par notre fournisseur ; une commande comportant plusieurs tailles peut être livrée en plusieurs colis,
        chacun faisant l&apos;objet d&apos;un email avec son numéro de suivi.
      </p>
      <p>
        Le délai de livraison estimé est indiqué sur la fiche produit et rappelé dans l&apos;email de
        confirmation. À défaut d&apos;indication, la livraison intervient au plus tard 30 jours après la
        conclusion du contrat (article L216-1 du Code de la consommation). Si le délai doit être allongé, le
        Client en est informé par email.
      </p>
      <p>
        En cas de manquement du Vendeur à son obligation de livraison dans le délai convenu, le Client peut,
        après l&apos;avoir enjoint sans succès de livrer dans un délai supplémentaire raisonnable, résoudre le
        contrat par lettre recommandée ou par écrit sur un autre support durable (article L216-6). Le Vendeur
        rembourse alors la totalité des sommes versées au plus tard dans les 14 jours suivant la date à
        laquelle le contrat a été dénoncé (article L216-7).
      </p>
      <p>
        Le transfert des risques de perte et d&apos;endommagement intervient au moment où le Client, ou un
        tiers désigné par lui, prend physiquement possession du produit (article L216-4). En cas de colis
        abîmé, le Client est invité à émettre des réserves auprès du transporteur et à contacter le Vendeur.
      </p>

      <h2>7. Droit de rétractation</h2>
      <p>
        Conformément aux articles L221-18 et suivants du Code de la consommation, le Client dispose d&apos;un
        délai de <strong>14 jours</strong> pour se rétracter, sans avoir à motiver sa décision. Ce délai court
        à compter de la réception du produit. Pour une commande de plusieurs produits livrés séparément, il
        court à compter de la réception du dernier produit.
      </p>
      <h3>Comment se rétracter</h3>
      <p>
        Le Client informe le Vendeur de sa décision avant l&apos;expiration du délai, au moyen du formulaire
        de rétractation en ligne, du modèle de formulaire figurant en annexe ou de toute autre déclaration
        dénuée d&apos;ambiguïté adressée à <Info>{legal.email}</Info>. Un accusé de réception lui est adressé
        par email.
      </p>
      <h3>Retour des produits</h3>
      <p>
        Le Client renvoie le produit à l&apos;adresse suivante : <Info>{legal.returnAddress}</Info>, sans
        retard excessif et au plus tard 14 jours après avoir communiqué sa décision de se rétracter.{" "}
        <strong>Les frais directs de renvoi sont à la charge du Client.</strong> Le produit doit être retourné
        complet ; la responsabilité du Client peut être engagée en cas de dépréciation résultant de
        manipulations autres que celles nécessaires pour établir sa nature, ses caractéristiques et son bon
        fonctionnement (article L221-23).
      </p>
      <h3>Remboursement</h3>
      <p>
        Le Vendeur rembourse la totalité des sommes versées, y compris les frais de livraison initiaux (dans
        la limite du mode de livraison standard proposé), au plus tard 14 jours à compter de la date à
        laquelle il est informé de la décision de rétractation. Il peut différer le remboursement jusqu&apos;à
        récupération du produit ou jusqu&apos;à ce que le Client ait fourni une preuve de son expédition, la
        date retenue étant celle du premier de ces faits (article L221-24). Le remboursement est effectué avec
        le même moyen de paiement que celui utilisé pour la commande.
      </p>
      <h3>Exceptions</h3>
      <p>
        L&apos;article L221-28 du Code de la consommation exclut le droit de rétractation pour certains biens
        (biens confectionnés selon les spécifications du consommateur, biens susceptibles de se détériorer
        rapidement, biens descellés ne pouvant être renvoyés pour des raisons d&apos;hygiène, etc.). Les
        produits vendus sur ce site n&apos;entrent dans aucune de ces exceptions.
      </p>

      <h2>8. Garanties légales</h2>
      <h3>Garantie légale de conformité</h3>
      <p className="border-cocoa/30 rounded-xl border bg-white p-4">
        Le consommateur dispose d&apos;un délai de deux ans à compter de la délivrance du bien pour obtenir la
        mise en œuvre de la garantie légale de conformité en cas d&apos;apparition d&apos;un défaut de
        conformité. Durant ce délai, le consommateur n&apos;est tenu d&apos;établir que l&apos;existence du
        défaut de conformité et non la date d&apos;apparition de celui-ci. La garantie légale de conformité
        emporte obligation pour le professionnel, le cas échéant, de fournir toutes les mises à jour
        nécessaires au maintien de la conformité du bien. La garantie légale de conformité donne au
        consommateur droit à la réparation ou au remplacement du bien dans un délai de trente jours suivant sa
        demande, sans frais et sans inconvénient majeur pour lui. Le consommateur peut obtenir une réduction
        du prix d&apos;achat en conservant le bien ou mettre fin au contrat en se faisant rembourser
        intégralement contre restitution du bien, si : le professionnel refuse de réparer ou de remplacer le
        bien ; la réparation ou le remplacement du bien intervient après un délai de trente jours ; la
        réparation ou le remplacement du bien occasionne un inconvénient majeur pour le consommateur,
        notamment lorsque le consommateur supporte définitivement les frais de reprise ou d&apos;enlèvement du
        bien non conforme, ou s&apos;il supporte les frais d&apos;installation du bien réparé ou de
        remplacement ; la non-conformité du bien persiste en dépit de la tentative de mise en conformité du
        vendeur restée infructueuse. Le consommateur a aussi droit à une réduction du prix du bien ou à la
        résolution du contrat lorsque le défaut de conformité est si grave qu&apos;il justifie que la
        réduction du prix ou la résolution du contrat soit immédiate. Le consommateur n&apos;est alors pas
        tenu de demander la réparation ou le remplacement du bien au préalable. Le consommateur n&apos;a pas
        droit à la résolution de la vente si le défaut de conformité est mineur. Toute période
        d&apos;immobilisation du bien en vue de sa réparation ou de son remplacement suspend la garantie qui
        restait à courir jusqu&apos;à la délivrance du bien remis en état. Les droits mentionnés ci-dessus
        résultent de l&apos;application des articles L. 217-1 à L. 217-32 du code de la consommation. Le
        vendeur qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité
        encourt une amende civile d&apos;un montant maximal de 300 000 euros, qui peut être porté jusqu&apos;à
        10 % du chiffre d&apos;affaires moyen annuel (article L. 242-18-1 du code de la consommation). Le
        consommateur bénéficie également de la garantie légale des vices cachés en application des articles
        1641 à 1649 du code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette
        garantie donne droit à une réduction de prix si le bien est conservé ou à un remboursement intégral
        contre restitution du bien.
      </p>
      <p>
        Pour mettre en œuvre ces garanties, le Client contacte le Vendeur à <Info>{legal.email}</Info> en
        indiquant son numéro de commande et en décrivant le défaut (photos bienvenues). Les frais de retour
        d&apos;un produit non conforme sont à la charge du Vendeur.
      </p>

      <h2>9. Service client et réclamations</h2>
      <p>
        Pour toute question ou réclamation : <Info>{legal.email}</Info> ou le formulaire de contact du site,
        en précisant le numéro de commande.
      </p>

      <h2>10. Médiation</h2>
      <p>
        En cas de litige non résolu par une réclamation écrite préalable auprès du Vendeur, le Client peut
        recourir gratuitement, dans un délai d&apos;un an à compter de cette réclamation, au médiateur de la
        consommation : <Info>{legal.mediator.name}</Info>, <Info>{legal.mediator.address}</Info>,{" "}
        <Info>{legal.mediator.website}</Info> (articles L612-1 et suivants du Code de la consommation).
      </p>

      <h2>11. Données personnelles</h2>
      <p>
        Les données collectées lors de la commande sont traitées conformément à notre{" "}
        <a href="/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>12. Droit applicable</h2>
      <p>
        Les présentes CGV sont soumises au droit français. En cas de litige, le Client peut saisir, à son
        choix, outre l&apos;une des juridictions territorialement compétentes en vertu du Code de procédure
        civile, la juridiction du lieu où il demeurait au moment de la conclusion du contrat ou de la
        survenance du fait dommageable (article R631-3 du Code de la consommation).
      </p>

      <h2 id="formulaire-retractation">Annexe — Modèle de formulaire de rétractation</h2>
      <p>
        (Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du
        contrat.)
      </p>
      <div className="border-cocoa/30 mt-3 rounded-xl border bg-white p-4">
        <p>
          À l&apos;attention de <Info>{legal.sellerName}</Info>, <Info>{legal.address}</Info>,{" "}
          <Info>{legal.email}</Info> :
        </p>
        <p>
          Je/Nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant
          sur la vente du bien (*) ci-dessous :
        </p>
        <ul>
          <li>Commandé le (*) / reçu le (*) :</li>
          <li>Numéro de commande :</li>
          <li>Nom du (des) consommateur(s) :</li>
          <li>Adresse du (des) consommateur(s) :</li>
          <li>
            Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur
            papier) :
          </li>
          <li>Date :</li>
        </ul>
        <p>(*) Rayez la mention inutile.</p>
      </div>
    </LegalPage>
  );
}
