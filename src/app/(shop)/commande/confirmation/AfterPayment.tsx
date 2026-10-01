"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearCartAction } from "./actions";

/**
 * Après le retour de Stripe : vide le panier, et tant que le webhook n'a pas confirmé le paiement,
 * recharge la page quelques fois (la redirection seule ne valide jamais une commande).
 */
export function AfterPayment({ waitingForWebhook }: { waitingForWebhook: boolean }) {
  const router = useRouter();

  useEffect(() => {
    void clearCartAction().then(() => router.refresh());
  }, [router]);

  useEffect(() => {
    if (!waitingForWebhook) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > 20) clearInterval(timer);
      else router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [waitingForWebhook, router]);

  return null;
}
