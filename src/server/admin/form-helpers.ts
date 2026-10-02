import { z } from "zod";
import { dateToParisLocalInput, parisLocalToDate } from "@/lib/paris-time";

// Schémas de saisie communs aux formulaires admin (montants en euros → centimes, dates, cases).

export const eurosToCents = z
  .string()
  .trim()
  .regex(/^\d{1,7}([.,]\d{1,2})?$/, "Montant invalide (ex. 29,90)")
  .transform((v) => Math.round(Number(v.replace(",", ".")) * 100));

export const optionalEurosToCents = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(eurosToCents.nullable());

export const percentToBps = z
  .string()
  .trim()
  .regex(/^\d{1,3}([.,]\d{1,2})?$/, "Pourcentage invalide")
  .transform((v) => Math.round(Number(v.replace(",", ".")) * 100))
  .refine((bps) => bps > 0 && bps <= 10_000, "Entre 0 et 100 %");

/** Champ datetime-local saisi en heure de Paris (le serveur tourne en UTC). */
export const optionalDate = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const date = parisLocalToDate(v);
    if (!date) ctx.addIssue({ code: "custom", message: "Date invalide" });
    return date;
  });

export const checkbox = (formData: FormData, name: string) => formData.get(name) === "on";

export const centsToInput = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ",");

export const dateToInput = (d: Date | null) => (d ? dateToParisLocalInput(d) : "");
