"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import {
  CONSENT_COOKIE_NAME,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_POLICY_VERSION,
  consentChoicesSchema,
  parseConsentCookie,
  type ConsentChoices,
  type ConsentCookie,
} from "@/lib/consent";
import { db } from "@/server/db";
import { checkRateLimit } from "@/server/security/ratelimit";

/**
 * Enregistre le choix du visiteur : cookie (6 mois) + preuve en base (identifiant aléatoire,
 * sans IP ni donnée identifiante), exigée par la CNIL pour démontrer le consentement.
 */
export async function saveConsentAction(choices: ConsentChoices): Promise<ConsentCookie | null> {
  const parsed = consentChoicesSchema.safeParse(choices);
  if (!parsed.success) return null;
  if (!(await checkRateLimit("consent"))) return null;

  const store = await cookies();
  const previous = parseConsentCookie(store.get(CONSENT_COOKIE_NAME)?.value);
  const consent: ConsentCookie = {
    v: CONSENT_POLICY_VERSION,
    id: previous?.id ?? randomUUID(),
    choices: parsed.data,
    at: Date.now(),
  };

  await db.consentRecord.create({
    data: { consentId: consent.id, choices: consent.choices, policyVersion: CONSENT_POLICY_VERSION },
  });

  store.set(CONSENT_COOKIE_NAME, JSON.stringify(consent), {
    // Le serveur lit ce cookie et transmet le choix aux composants : aucun script n'a besoin d'y accéder.
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CONSENT_MAX_AGE_SECONDS,
  });
  return consent;
}
