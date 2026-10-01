import { z } from "zod";

/**
 * Identité légale du vendeur (stockée dans ShopSettings.legalIdentity, éditée dans l'admin).
 * Toute information inconnue reste un placeholder visible `[À COMPLÉTER : …]` :
 * on n'invente jamais une donnée légale.
 */

export const todo = (what: string) => `[À COMPLÉTER : ${what}]`;

export const legalIdentitySchema = z.object({
  sellerName: z.string().min(1),
  tradeName: z.string().min(1),
  legalStatus: z.string().min(1),
  siret: z.string().min(1),
  address: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().min(1),
  publicationDirector: z.string().min(1),
  returnAddress: z.string().min(1),
  host: z.object({ name: z.string().min(1), address: z.string().min(1), contact: z.string().min(1) }),
  mediator: z.object({ name: z.string().min(1), address: z.string().min(1), website: z.string().min(1) }),
});

export type LegalIdentity = z.infer<typeof legalIdentitySchema>;

export const PLACEHOLDER_LEGAL_IDENTITY: LegalIdentity = {
  sellerName: todo("prénom et nom de l'entrepreneur"),
  tradeName: todo("nom commercial de la boutique"),
  legalStatus: "Entrepreneur individuel (micro-entreprise)",
  siret: todo("numéro SIRET"),
  address: todo("adresse postale du siège"),
  email: todo("adresse email de contact"),
  phone: todo("numéro de téléphone (facultatif mais recommandé)"),
  publicationDirector: todo("directeur de la publication (toi)"),
  returnAddress: todo("adresse de retour des colis en France"),
  host: {
    name: "Vercel Inc.",
    address: todo("adresse postale de Vercel Inc. à vérifier sur vercel.com/legal"),
    contact: "https://vercel.com/contact",
  },
  mediator: {
    name: todo("nom du médiateur de la consommation"),
    address: todo("adresse du médiateur"),
    website: todo("site internet du médiateur"),
  },
};

export function isPlaceholder(value: string): boolean {
  return value.includes("[À COMPLÉTER");
}
