/**
 * CSV pour tableur français (Excel, LibreOffice) : séparateur « ; », BOM UTF-8, décimales à la
 * virgule, dates jj/mm/aaaa en heure de Paris.
 */

const date = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export function csvDate(value: Date | null): string {
  return value ? date.format(value) : "";
}

export function csvAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Cellule texte : guillemets échappés, et neutralisation de l'injection de formule
 * (une cellule commençant par = + - @ serait exécutée par le tableur).
 */
export function csvText(value: string | null | undefined): string {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: string[][]): string {
  const lines = [header.map(csvText).join(";"), ...rows.map((r) => r.join(";"))];
  return `﻿${lines.join("\r\n")}\r\n`;
}
