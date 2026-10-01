-- Le PDF est désormais stocké en accès privé : on garde une clé de stockage, pas une URL publique.
-- Renommage plutôt que suppression : aucune donnée n'est perdue.
ALTER TABLE "Invoice" RENAME COLUMN "pdfBlobUrl" TO "pdfStorageKey";
ALTER TABLE "Invoice" ALTER COLUMN "pdfStorageKey" DROP NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "pdfSha256" DROP NOT NULL;

-- Une facture émise est immuable (obligation fiscale) :
-- - aucune suppression ;
-- - aucune modification, sauf l'enregistrement unique du PDF juste après l'émission
--   (pdfStorageKey et pdfSha256 passent de NULL à une valeur, une seule fois).
CREATE OR REPLACE FUNCTION invoice_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Facture % : suppression interdite (pièce comptable)', OLD."number";
  END IF;

  IF (to_jsonb(NEW) - 'pdfStorageKey' - 'pdfSha256') IS DISTINCT FROM (to_jsonb(OLD) - 'pdfStorageKey' - 'pdfSha256') THEN
    RAISE EXCEPTION 'Facture % : modification interdite, émettre un avoir', OLD."number";
  END IF;

  IF OLD."pdfStorageKey" IS NOT NULL AND NEW."pdfStorageKey" IS DISTINCT FROM OLD."pdfStorageKey" THEN
    RAISE EXCEPTION 'Facture % : le PDF émis ne peut pas être remplacé', OLD."number";
  END IF;
  IF OLD."pdfSha256" IS NOT NULL AND NEW."pdfSha256" IS DISTINCT FROM OLD."pdfSha256" THEN
    RAISE EXCEPTION 'Facture % : l''empreinte du PDF émis ne peut pas être modifiée', OLD."number";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_immutable_update BEFORE UPDATE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION invoice_immutable();
CREATE TRIGGER invoice_immutable_delete BEFORE DELETE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION invoice_immutable();

-- Une note d'avis est toujours comprise entre 1 et 5.
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
