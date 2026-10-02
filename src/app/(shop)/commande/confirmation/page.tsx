import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { db } from "@/server/db";
import { TrackEvent } from "@/components/marketing/TrackEvent";
import { AfterPayment } from "./AfterPayment";

export const metadata: Metadata = { title: "Confirmation de commande", robots: { index: false } };

const sessionIdSchema = z.string().regex(/^cs_(test|live)_[A-Za-z0-9]{10,200}$/);

function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}${"•".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

export default async function ConfirmationPage({ searchParams }: PageProps<"/commande/confirmation">) {
  const parsed = sessionIdSchema.safeParse((await searchParams).session_id);
  const order = parsed.success
    ? await db.order.findUnique({
        where: { stripeCheckoutSessionId: parsed.data },
        select: {
          number: true,
          status: true,
          email: true,
          adsConsent: true,
          marketingEventId: true,
          totalCents: true,
          items: {
            select: {
              sku: true,
              productName: true,
              variantLabel: true,
              quantity: true,
              unitPriceCents: true,
            },
          },
        },
      })
    : null;

  if (!order) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-cocoa font-serif text-3xl">Commande introuvable</h1>
        <p className="mt-4">
          Si vous venez de payer, vous recevrez un email de confirmation. Sinon,{" "}
          <Link href="/panier" className="underline">
            retournez au panier
          </Link>
          .
        </p>
      </main>
    );
  }

  const waiting = order.status === "PENDING_PAYMENT";
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <AfterPayment waitingForWebhook={waiting} />
      {waiting ? (
        <div role="status">
          <h1 className="text-cocoa font-serif text-3xl">Paiement en cours de validation…</h1>
          <p className="mt-4">
            Nous attendons la confirmation de votre banque pour la commande <strong>{order.number}</strong>.
            Cette page se met à jour automatiquement ; vous recevrez aussi un email.
          </p>
        </div>
      ) : (
        <div role="status">
          {order.adsConsent && order.marketingEventId && (
            <TrackEvent
              event={{
                name: "Purchase",
                eventId: order.marketingEventId,
                valueCents: order.totalCents,
                contents: order.items.map((i) => ({
                  id: i.sku,
                  name: `${i.productName} — ${i.variantLabel}`,
                  quantity: i.quantity,
                  priceCents: i.unitPriceCents,
                })),
              }}
            />
          )}
          <h1 className="text-cocoa font-serif text-3xl">Merci, votre commande est confirmée</h1>
          <p className="mt-4">
            Commande <strong>{order.number}</strong>. Un email de confirmation avec votre facture a été envoyé
            à {maskEmail(order.email)}.
          </p>
          <p className="mt-2">Vous recevrez le numéro de suivi dès l&apos;expédition.</p>
          <Link href="/suivi" className="mt-6 inline-block underline">
            Suivre ma commande
          </Link>
        </div>
      )}
    </main>
  );
}
