import type { Metadata } from "next";
import { Info, LegalPage } from "@/components/shop/LegalPage";
import { getShopConfig } from "@/server/settings/settings";

export const metadata: Metadata = { title: "Mentions légales" };

export default async function MentionsLegales() {
  const { legal, shopName, taxMode } = await getShopConfig();
  return (
    <LegalPage title="Mentions légales" updatedAt="1er octobre 2026">
      <h2>Éditeur du site</h2>
      <p>
        Le site <Info>{shopName}</Info> est édité par <Info>{legal.sellerName}</Info>, {legal.legalStatus},
        exerçant sous le nom commercial <Info>{legal.tradeName}</Info>.
      </p>
      <ul>
        <li>
          SIRET : <Info>{legal.siret}</Info>
        </li>
        <li>
          Adresse : <Info>{legal.address}</Info>
        </li>
        <li>
          Email : <Info>{legal.email}</Info>
        </li>
        <li>
          Téléphone : <Info>{legal.phone}</Info>
        </li>
        {taxMode === "FRANCHISE_293B" && (
          <li>TVA non applicable, article 293 B du Code général des impôts.</li>
        )}
      </ul>
      <p>
        Directeur de la publication : <Info>{legal.publicationDirector}</Info>.
      </p>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé par <Info>{legal.host.name}</Info>, <Info>{legal.host.address}</Info> (
        <Info>{legal.host.contact}</Info>). Les données de la boutique sont stockées dans l&apos;Union
        européenne (Francfort, Allemagne).
      </p>

      <h2>Médiation de la consommation</h2>
      <p>
        Conformément à l&apos;article L612-1 du Code de la consommation, vous pouvez recourir gratuitement au
        médiateur de la consommation suivant : <Info>{legal.mediator.name}</Info>,{" "}
        <Info>{legal.mediator.address}</Info>, <Info>{legal.mediator.website}</Info>.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes, photographies et vidéos de ce site sont la propriété de l&apos;éditeur, sauf mention
        contraire. Toute reproduction sans autorisation est interdite.
      </p>

      <h2>Données personnelles et cookies</h2>
      <p>
        Voir la <a href="/confidentialite">politique de confidentialité</a> et la{" "}
        <a href="/cookies">politique cookies</a>.
      </p>
    </LegalPage>
  );
}
