import { ActionForm } from "@/components/admin/ActionForm";
import { Card, Field, inputClass, PageTitle, secondaryButtonClass } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import { moderateReviewAction } from "./actions";

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });
const STATUS = { PENDING: "En attente", APPROVED: "Publié", REJECTED: "Refusé" } as const;

export default async function ReviewsAdminPage() {
  await requireAdmin();
  const reviews = await db.review.findMany({
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
    take: 100,
    include: { orderItem: { select: { variantLabel: true, order: { select: { number: true } } } } },
  });
  return (
    <>
      <PageTitle>Avis clients</PageTitle>
      <p className="mb-4 text-sm text-stone-600">
        Règles affichées publiquement : avis positifs et négatifs publiés ; refus uniquement pour propos
        injurieux, données personnelles, hors sujet ou fraude. Le texte d&apos;un avis ne se modifie jamais.
      </p>
      {reviews.length === 0 && <p className="text-sm text-stone-500">Aucun avis pour le moment.</p>}
      {reviews.map((r) => (
        <Card
          key={r.id}
          title={`${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)} ${r.displayName} — ${STATUS[r.status]}`}
        >
          <p className="text-sm whitespace-pre-wrap">{r.body}</p>
          <p className="mt-1 text-xs text-stone-500">
            Commande {r.orderItem.order.number} — taille {r.orderItem.variantLabel} — reçu le{" "}
            {date.format(r.submittedAt)}
          </p>
          <ActionForm
            action={moderateReviewAction}
            submitLabel="Valider la décision"
            submitClassName={secondaryButtonClass}
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="reviewId" value={r.id} />
            <select
              name="decision"
              defaultValue={r.status === "REJECTED" ? "REJECTED" : "APPROVED"}
              className={inputClass}
              aria-label="Décision"
            >
              <option value="APPROVED">Publier</option>
              <option value="REJECTED">Refuser</option>
            </select>
            <Field label="Motif (obligatoire en cas de refus)">
              <input name="note" defaultValue={r.moderationNote ?? ""} className={inputClass} />
            </Field>
          </ActionForm>
        </Card>
      ))}
    </>
  );
}
