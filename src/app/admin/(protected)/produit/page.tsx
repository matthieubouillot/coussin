import { ActionForm } from "@/components/admin/ActionForm";
import { MediaUploader } from "@/components/admin/MediaUploader";
import {
  buttonClass,
  Card,
  dangerButtonClass,
  Field,
  inputClass,
  Notice,
  PageTitle,
  secondaryButtonClass,
} from "@/components/admin/ui";
import { formatEuros } from "@/lib/money";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { SupplierLookup } from "@/components/admin/SupplierLookup";
import {
  createVariantAction,
  deleteMediaAction,
  deleteOfferAction,
  saveMediaAction,
  saveOfferAction,
  saveProductAction,
  saveVariantAction,
  syncStockNowAction,
} from "./actions";

const cents = (v: number) => (v / 100).toFixed(2).replace(".", ",");

export default async function ProductAdminPage() {
  await requireAdmin();
  const product = await db.product.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      media: { orderBy: { position: "asc" } },
      variants: { orderBy: { position: "asc" }, include: { offers: { orderBy: { priority: "asc" } } } },
    },
  });
  if (!product) {
    return (
      <>
        <PageTitle>Produit</PageTitle>
        <Notice tone="warning">
          Aucun produit en base. Lancez le seed de développement ou créez-le via une migration de données.
        </Notice>
      </>
    );
  }

  const gpsrMissing = !product.manufacturerName || !product.euResponsibleName || !product.safetyWarnings;

  return (
    <>
      <PageTitle>Produit</PageTitle>
      {gpsrMissing && (
        <Notice tone="warning">
          Informations GPSR incomplètes (fabricant, responsable UE, avertissements) : obligatoires avant la
          mise en vente.
        </Notice>
      )}

      <Card title="Fiche produit">
        <ActionForm
          action={saveProductAction}
          submitLabel="Enregistrer le produit"
          submitClassName={buttonClass}
          className="grid gap-4 md:grid-cols-2"
        >
          <input type="hidden" name="id" value={product.id} />
          <Field label="Nom">
            <input name="name" defaultValue={product.name} required className={inputClass} />
          </Field>
          <Field label="Accroche">
            <input name="tagline" defaultValue={product.tagline} required className={inputClass} />
          </Field>
          <Field label="Contenu du colis">
            <input
              name="packageContents"
              defaultValue={product.packageContents}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Composition textile" hint="Vérifiée auprès du fabricant">
            <input
              name="textileComposition"
              defaultValue={product.textileComposition ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Consignes d'entretien">
            <textarea
              name="careInstructions"
              defaultValue={product.careInstructions ?? ""}
              rows={2}
              className={inputClass}
            />
          </Field>
          <Field label="Consignes de tri (si obligation de marquage)">
            <textarea
              name="sortingInstructions"
              defaultValue={product.sortingInstructions ?? ""}
              rows={2}
              className={inputClass}
            />
          </Field>
          <Field label="Fabricant — nom">
            <input
              name="manufacturerName"
              defaultValue={product.manufacturerName ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Fabricant — adresse">
            <input
              name="manufacturerAddress"
              defaultValue={product.manufacturerAddress ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Fabricant — contact (email/site)">
            <input
              name="manufacturerContact"
              defaultValue={product.manufacturerContact ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Responsable UE — nom">
            <input
              name="euResponsibleName"
              defaultValue={product.euResponsibleName ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Responsable UE — adresse">
            <input
              name="euResponsibleAddress"
              defaultValue={product.euResponsibleAddress ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Responsable UE — contact">
            <input
              name="euResponsibleContact"
              defaultValue={product.euResponsibleContact ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Référence produit">
            <input
              name="productReference"
              defaultValue={product.productReference ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Adaptateur fournisseur par défaut">
            <select name="defaultAdapter" defaultValue={product.defaultAdapter} className={inputClass}>
              <option value="ALIEXPRESS">AliExpress</option>
              <option value="CJ">CJ Dropshipping</option>
              <option value="MANUAL">Manuel</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Avertissements et consignes de sécurité">
              <textarea
                name="safetyWarnings"
                defaultValue={product.safetyWarnings ?? ""}
                rows={3}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field
              label="Contenus éditoriaux (JSON)"
              hint="Fonctionnement, bénéfices, entretien, FAQ, engagements. Structure vérifiée à l'enregistrement."
            >
              <textarea
                name="contentBlocks"
                defaultValue={JSON.stringify(product.contentBlocks, null, 2)}
                rows={14}
                className={`${inputClass} font-mono text-xs`}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Guide des tailles (JSON)">
              <textarea
                name="sizeGuide"
                defaultValue={JSON.stringify(product.sizeGuide, null, 2)}
                rows={8}
                className={`${inputClass} font-mono text-xs`}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" name="active" defaultChecked={product.active} /> Produit en vente
          </label>
        </ActionForm>
      </Card>

      <Card title="Fournisseurs">
        <div className="grid gap-6 md:grid-cols-2">
          <ActionForm
            action={syncStockNowAction}
            submitLabel="Synchroniser stock et prix maintenant"
            submitClassName={secondaryButtonClass}
          >
            <p className="text-sm text-stone-600">
              Automatique chaque jour à 8 h. Le prix de vente n&apos;est jamais modifié automatiquement.
            </p>
          </ActionForm>
          <SupplierLookup />
        </div>
      </Card>

      {product.variants.map((variant) => (
        <Card
          key={variant.id}
          title={`Taille ${variant.label} — ${formatEuros(variant.priceCents)} (${variant.sku})`}
        >
          <ActionForm
            action={saveVariantAction}
            submitLabel="Enregistrer la taille"
            submitClassName={secondaryButtonClass}
            className="grid gap-3 md:grid-cols-4"
          >
            <input type="hidden" name="id" value={variant.id} />
            <Field label="Libellé">
              <input name="label" defaultValue={variant.label} required className={inputClass} />
            </Field>
            <Field label="Prix de vente TTC (€)" hint="Chaque changement est historisé">
              <input name="price" defaultValue={cents(variant.priceCents)} required className={inputClass} />
            </Field>
            <Field label="Largeur (cm)">
              <input
                name="widthCm"
                type="number"
                defaultValue={variant.widthCm}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Longueur (cm)">
              <input
                name="lengthCm"
                type="number"
                defaultValue={variant.lengthCm}
                required
                className={inputClass}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Conseillé pour">
                <input
                  name="recommendedFor"
                  defaultValue={variant.recommendedFor}
                  required
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Ordre d'affichage">
              <input name="position" type="number" defaultValue={variant.position} className={inputClass} />
            </Field>
            <div className="space-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="active" defaultChecked={variant.active} /> En vente
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="showReferencePrice"
                  defaultChecked={variant.showReferencePrice}
                />{" "}
                Afficher le prix barré s&apos;il est légalement justifié
              </label>
            </div>
          </ActionForm>

          <h3 className="mt-6 mb-2 text-sm font-medium">Offres fournisseur (ordre de priorité)</h3>
          {variant.offers.length === 0 && (
            <Notice tone="danger">Aucune offre : cette taille est affichée en rupture.</Notice>
          )}
          <div className="space-y-4">
            {[...variant.offers, null].map((offer) => (
              <details
                key={offer?.id ?? "new"}
                className="rounded-lg border border-stone-200 p-3"
                open={!offer && variant.offers.length === 0}
              >
                <summary className="cursor-pointer text-sm">
                  {offer
                    ? `#${offer.priority} ${offer.supplierName} (${offer.adapter}) — achat ${formatEuros(offer.purchaseCostCents)} + port ${formatEuros(offer.shippingCostCents)} — ${offer.deliveryDaysMin}-${offer.deliveryDaysMax} j — stock ${offer.lastKnownStock ?? "inconnu"}${offer.active ? "" : " — inactive"}`
                    : "+ Ajouter une offre fournisseur"}
                </summary>
                <ActionForm
                  action={saveOfferAction}
                  submitLabel="Enregistrer l'offre"
                  submitClassName={secondaryButtonClass}
                  className="mt-3 grid gap-3 md:grid-cols-4"
                >
                  <input type="hidden" name="variantId" value={variant.id} />
                  {offer && <input type="hidden" name="offerId" value={offer.id} />}
                  <Field label="Priorité (1 = principale)">
                    <input
                      name="priority"
                      type="number"
                      min={1}
                      defaultValue={offer?.priority ?? variant.offers.length + 1}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Adaptateur">
                    <select
                      name="adapter"
                      defaultValue={offer?.adapter ?? "ALIEXPRESS"}
                      className={inputClass}
                    >
                      <option value="ALIEXPRESS">AliExpress</option>
                      <option value="CJ">CJ Dropshipping</option>
                      <option value="MANUAL">Manuel</option>
                    </select>
                  </Field>
                  <Field label="Fournisseur">
                    <input
                      name="supplierName"
                      defaultValue={offer?.supplierName ?? ""}
                      required
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Lien de l'offre (https)">
                    <input
                      name="externalUrl"
                      defaultValue={offer?.externalUrl ?? ""}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="ID produit fournisseur">
                    <input
                      name="externalProductId"
                      defaultValue={offer?.externalProductId ?? ""}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="ID variante (SKU) fournisseur">
                    <input
                      name="externalSkuId"
                      defaultValue={offer?.externalSkuId ?? ""}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Prix d'achat (€)">
                    <input
                      name="purchaseCost"
                      defaultValue={offer ? cents(offer.purchaseCostCents) : ""}
                      required
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Port fournisseur (€)">
                    <input
                      name="shippingCost"
                      defaultValue={offer ? cents(offer.shippingCostCents) : "0,00"}
                      required
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Délai min (jours)">
                    <input
                      name="deliveryDaysMin"
                      type="number"
                      defaultValue={offer?.deliveryDaysMin ?? 7}
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Délai max (jours)"
                    hint="Affiché au client : jamais plus optimiste que le réel"
                  >
                    <input
                      name="deliveryDaysMax"
                      type="number"
                      defaultValue={offer?.deliveryDaysMax ?? 14}
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Mode d'expédition fournisseur"
                    hint="AliExpress : logistics_service_name ; CJ : logisticName"
                  >
                    <input
                      name="shippingMethod"
                      defaultValue={offer?.shippingMethod ?? ""}
                      className={inputClass}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={offer?.active ?? true} /> Active
                  </label>
                </ActionForm>
                {offer && (offer.lastSyncedAt || offer.lastSyncError) && (
                  <p className={`mt-2 text-xs ${offer.lastSyncError ? "text-red-700" : "text-stone-500"}`}>
                    {offer.lastSyncError
                      ? `Dernière synchronisation en erreur : ${offer.lastSyncError}`
                      : `Synchronisée le ${offer.lastSyncedAt?.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`}
                  </p>
                )}
                {offer && (
                  <form action={deleteOfferAction} className="mt-2">
                    <input type="hidden" name="offerId" value={offer.id} />
                    <button type="submit" className="text-sm text-red-700 underline">
                      Supprimer l&apos;offre (désactivée si déjà utilisée)
                    </button>
                  </form>
                )}
              </details>
            ))}
          </div>
        </Card>
      ))}

      <Card title="Ajouter une taille">
        <ActionForm
          action={createVariantAction}
          submitLabel="Ajouter la taille"
          submitClassName={secondaryButtonClass}
          className="grid gap-3 md:grid-cols-4"
        >
          <input type="hidden" name="productId" value={product.id} />
          <Field label="SKU">
            <input name="sku" required placeholder="COUSSIN-XL" className={inputClass} />
          </Field>
          <Field label="Libellé">
            <input name="label" required placeholder="XL — 70 × 110 cm" className={inputClass} />
          </Field>
          <Field label="Prix TTC (€)">
            <input name="price" required className={inputClass} />
          </Field>
          <Field label="Conseillé pour">
            <input name="recommendedFor" required className={inputClass} />
          </Field>
          <Field label="Largeur (cm)">
            <input name="widthCm" type="number" required className={inputClass} />
          </Field>
          <Field label="Longueur (cm)">
            <input name="lengthCm" type="number" required className={inputClass} />
          </Field>
        </ActionForm>
      </Card>

      <Card title="Photos et vidéos">
        <ul className="mb-4 grid gap-3 md:grid-cols-2">
          {product.media.map((m) => (
            <li key={m.id} className="rounded-lg border border-stone-200 p-3 text-sm">
              <p className="mb-2 truncate text-stone-500">
                {m.kind} — {m.width}×{m.height} — {m.blobUrl}
              </p>
              <ActionForm
                action={saveMediaAction}
                submitLabel="Enregistrer"
                submitClassName={secondaryButtonClass}
                className="flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="mediaId" value={m.id} />
                <input
                  name="alt"
                  defaultValue={m.alt}
                  aria-label="Texte alternatif"
                  className={`${inputClass} flex-1`}
                />
                <input
                  name="position"
                  type="number"
                  defaultValue={m.position}
                  aria-label="Position"
                  className={`${inputClass} w-20`}
                />
              </ActionForm>
              <form action={deleteMediaAction}>
                <input type="hidden" name="mediaId" value={m.id} />
                <button type="submit" className={`${dangerButtonClass} mt-2`}>
                  Retirer
                </button>
              </form>
            </li>
          ))}
        </ul>
        {env().BLOB_READ_WRITE_TOKEN ? (
          <MediaUploader productId={product.id} />
        ) : (
          <Notice tone="info">L&apos;envoi de médias nécessite BLOB_READ_WRITE_TOKEN (Vercel Blob).</Notice>
        )}
      </Card>
    </>
  );
}
