import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Card, dangerButtonClass, Field, inputClass, Notice, PageTitle } from "@/components/admin/ui";
import { formatEuros } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { adminHref } from "@/server/auth/admin-path";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import { anonymizeCustomerAction } from "../actions";

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Europe/Paris" });

export default async function CustomerPage({ params }: PageProps<"/admin/clients/[id]">) {
  await requireAdmin();
  const customer = await db.customer.findUnique({
    where: { id: (await params).id },
    include: { orders: { orderBy: { createdAt: "desc" } } },
  });
  if (!customer) notFound();

  return (
    <>
      <PageTitle>
        {customer.anonymizedAt
          ? "Client anonymisé"
          : [customer.firstName, customer.lastName].filter(Boolean).join(" ")}
      </PageTitle>
      {customer.anonymizedAt && <Notice>Anonymisé le {date.format(customer.anonymizedAt)}.</Notice>}
      <Card title="Coordonnées">
        <p className="text-sm">
          {customer.email}
          <br />
          {customer.phone ?? "—"}
          <br />
          Client depuis le {date.format(customer.createdAt)}
        </p>
      </Card>
      <Card title="Commandes">
        <ul className="space-y-1 text-sm">
          {customer.orders.map((o) => (
            <li key={o.id}>
              <Link href={adminHref(`/commandes/${o.id}`)} className="font-mono underline">
                {o.number}
              </Link>{" "}
              — {date.format(o.createdAt)} — {ORDER_STATUS_LABELS[o.status]} — {formatEuros(o.totalCents)}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Droits RGPD">
        <p className="mb-3 text-sm">
          <a href={`/api/admin/clients/${customer.id}/export`} className="underline">
            Exporter toutes les données de ce client (JSON)
          </a>{" "}
          — à transmettre en réponse à une demande d&apos;accès ou de portabilité (délai : 1 mois).
        </p>
        {!customer.anonymizedAt && (
          <ActionForm
            action={anonymizeCustomerAction}
            submitLabel="Anonymiser définitivement"
            submitClassName={dangerButtonClass}
          >
            <input type="hidden" name="customerId" value={customer.id} />
            <Field
              label="Demande d'effacement : tapez ANONYMISER pour confirmer"
              hint="Supprime nom, email, téléphone, adresses et messages. Les factures restent conservées 10 ans (obligation comptable)."
            >
              <input name="confirm" autoComplete="off" className={inputClass} />
            </Field>
          </ActionForm>
        )}
      </Card>
    </>
  );
}
