"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { saveConsentAction } from "@/app/consent-actions";
import {
  ACCEPT_ALL,
  CONSENT_PURPOSES,
  REFUSE_ALL,
  type ConsentChoices,
  type ConsentCookie,
} from "@/lib/consent";

export const OPEN_CONSENT_EVENT = "consent:open";

/**
 * Bandeau cookies conforme CNIL :
 * - « Tout refuser » et « Tout accepter » au même niveau, même taille, même écran ;
 * - choix granulaire via « Personnaliser » ;
 * - fermer sans choisir n'est pas possible autrement qu'en refusant (pas de croix trompeuse) ;
 * - rouvrable à tout moment depuis le pied de page.
 */
export function CookieConsent({ initialConsent }: { initialConsent: ConsentCookie | null }) {
  const [consent, setConsent] = useState(initialConsent);
  const [open, setOpen] = useState(initialConsent === null);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<ConsentChoices>(initialConsent?.choices ?? REFUSE_ALL);
  const [pending, startTransition] = useTransition();
  const titleId = useId();

  useEffect(() => {
    const reopen = () => {
      setDraft(consent?.choices ?? REFUSE_ALL);
      setCustomizing(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, [consent]);

  function save(choices: ConsentChoices) {
    startTransition(async () => {
      const saved = await saveConsentAction(choices);
      if (saved) setConsent(saved);
      setOpen(false);
      setCustomizing(false);
    });
  }

  if (!open) return null;

  const buttonClass =
    "min-h-11 flex-1 rounded-full border-2 border-cocoa px-5 py-2 font-medium transition-colors disabled:opacity-60";

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="border-cocoa/20 fixed inset-x-0 bottom-0 z-50 border-t bg-white p-4 shadow-2xl sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:max-w-2xl sm:rounded-2xl sm:border sm:p-6"
    >
      <h2 id={titleId} className="text-cocoa font-serif text-xl">
        Vos choix en matière de cookies
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        Nous utilisons des cookies indispensables au fonctionnement du site (panier, sécurité). Avec votre
        accord, nous aimerions aussi mesurer l&apos;efficacité de nos publicités. Vous pouvez accepter,
        refuser ou choisir finalité par finalité ; votre choix est conservé 6 mois et modifiable à tout moment
        via le lien « Gérer mes cookies » en bas de page.{" "}
        <a href="/cookies" className="underline underline-offset-2">
          En savoir plus
        </a>
      </p>

      {customizing && (
        <fieldset className="mt-4 space-y-3">
          <legend className="sr-only">Finalités</legend>
          <div className="bg-cream rounded-xl p-3 text-sm">
            <p className="font-medium">Cookies indispensables — toujours actifs</p>
            <p className="text-ink/80">
              Panier, sécurité, mémorisation de vos choix. Exemptés de consentement.
            </p>
          </div>
          {CONSENT_PURPOSES.map((purpose) => (
            <label key={purpose.key} className="bg-cream flex gap-3 rounded-xl p-3 text-sm">
              <input
                type="checkbox"
                className="accent-cocoa mt-1 size-5"
                checked={draft[purpose.key]}
                onChange={(e) => setDraft({ ...draft, [purpose.key]: e.target.checked })}
              />
              <span>
                <span className="block font-medium">{purpose.title}</span>
                <span className="text-ink/80">{purpose.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pending}
          onClick={() => save(REFUSE_ALL)}
          className={`${buttonClass} text-cocoa hover:bg-cream bg-white`}
        >
          Tout refuser
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => save(ACCEPT_ALL)}
          className={`${buttonClass} text-cocoa hover:bg-cream bg-white`}
        >
          Tout accepter
        </button>
        {customizing ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => save(draft)}
            className={`${buttonClass} bg-cocoa hover:bg-cocoa/90 text-white`}
          >
            Enregistrer mes choix
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setCustomizing(true)}
            className={`${buttonClass} text-cocoa hover:bg-cream bg-white`}
          >
            Personnaliser
          </button>
        )}
      </div>
    </section>
  );
}
