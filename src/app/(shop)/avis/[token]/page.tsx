import type { Metadata } from "next";
import Link from "next/link";
import { defaultDisplayName, findInvite } from "@/server/reviews/invites";
import { ReviewForm } from "./ReviewForm";

export const metadata: Metadata = { title: "Donner mon avis", robots: { index: false } };

export default async function ReviewPage({ params }: PageProps<"/avis/[token]">) {
  const { token } = await params;
  const invite = await findInvite(token);
  const items = invite?.order.items.filter((i) => !i.review) ?? [];

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-12">
      <h1 className="text-cocoa font-serif text-3xl">Votre avis</h1>
      {!invite || items.length === 0 ? (
        <p>Ce lien n&apos;est plus valable (déjà utilisé ou expiré).</p>
      ) : (
        <>
          <p className="text-sm">
            Votre avis, positif ou négatif, sera publié après relecture, avec la mention « Achat vérifié ».
            Aucune contrepartie n&apos;est accordée.{" "}
            <Link href="/avis-clients" className="underline">
              Notre politique d&apos;avis
            </Link>
          </p>
          {items.map((item) => (
            <ReviewForm
              key={item.id}
              token={token}
              orderItemId={item.id}
              label={`${item.productName} — taille ${item.variantLabel}`}
              defaultName={defaultDisplayName(invite.order.shippingName)}
            />
          ))}
        </>
      )}
    </main>
  );
}
