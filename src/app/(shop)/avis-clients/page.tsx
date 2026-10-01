import type { Metadata } from "next";
import { LegalPage } from "@/components/shop/LegalPage";

export const metadata: Metadata = { title: "Comment nous collectons les avis" };

// Information obligatoire sur le contrôle des avis (article L111-7-2 et D111-17 du Code de la consommation).
export default function AvisClients() {
  return (
    <LegalPage title="Comment nous collectons et contrôlons les avis" updatedAt="1er octobre 2026">
      <h2>Qui peut déposer un avis ?</h2>
      <p>
        Uniquement les clients ayant réellement acheté et reçu le coussin. Environ 7 jours après la livraison,
        nous envoyons à chaque client un lien personnel et à usage unique ; un avis ne peut être déposé
        qu&apos;à partir de ce lien et ne porte que sur un produit effectivement commandé. Chaque avis publié
        porte la mention « Achat vérifié ».
      </p>

      <h2>Les avis sont-ils contrôlés ?</h2>
      <p>
        Oui. Chaque avis est relu avant publication, généralement sous 7 jours. Les avis positifs comme
        négatifs sont publiés. Un avis n&apos;est refusé que s&apos;il contient des propos injurieux ou
        discriminatoires, des données personnelles, un contenu sans rapport avec le produit, ou s&apos;il est
        manifestement frauduleux. Le client est informé en cas de refus et du motif.
      </p>

      <h2>Contreparties</h2>
      <p>
        Aucune contrepartie (réduction, cadeau, remboursement) n&apos;est accordée en échange d&apos;un avis.
      </p>

      <h2>Affichage</h2>
      <p>
        Les avis sont affichés du plus récent au plus ancien, avec leur note, le prénom et l&apos;initiale du
        nom de leur auteur. La note moyenne est calculée sur l&apos;ensemble des avis publiés. Aucun avis ne
        provient d&apos;une autre plateforme (place de marché, fournisseur) : seuls nos propres clients
        s&apos;expriment ici.
      </p>

      <h2>Signaler un avis</h2>
      <p>
        Vous pouvez nous signaler un avis qui vous semble inapproprié via le formulaire de contact ; il sera
        réexaminé.
      </p>
    </LegalPage>
  );
}
