/**
 * Bornes de périodes en heure de Paris (comptabilité, tableau de bord), quel que soit le fuseau
 * du serveur (UTC sur Vercel).
 */

function parisOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Instant UTC correspondant à minuit, heure de Paris, à la date civile donnée. */
export function parisMidnight(year: number, month: number, day: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day));
  const offset = parisOffsetMinutes(guess);
  const candidate = new Date(guess.getTime() - offset * 60_000);
  // Recalage si un changement d'heure tombe entre l'estimation et le résultat.
  const offset2 = parisOffsetMinutes(candidate);
  return offset2 === offset ? candidate : new Date(guess.getTime() - offset2 * 60_000);
}

export function parisDateParts(at: Date = new Date()): { year: number; month: number; day: number } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" })
    .format(at)
    .split("-")
    .map(Number);
  return { year: y!, month: m!, day: d! };
}

export type Period = { start: Date; end: Date };

export function periodOf(kind: "day" | "month" | "year", at: Date = new Date()): Period {
  const { year, month, day } = parisDateParts(at);
  if (kind === "day")
    return { start: parisMidnight(year, month, day), end: parisMidnight(year, month, day + 1) };
  if (kind === "month")
    return { start: parisMidnight(year, month, 1), end: parisMidnight(year, month + 1, 1) };
  return { start: parisMidnight(year, 1, 1), end: parisMidnight(year + 1, 1, 1) };
}

/** Période comptable : mois (1-12), trimestre (1-4) ou année entière. */
export function accountingPeriod(year: number, kind: "month" | "quarter" | "year", index = 1): Period {
  if (kind === "year") return { start: parisMidnight(year, 1, 1), end: parisMidnight(year + 1, 1, 1) };
  if (kind === "quarter") {
    const first = (index - 1) * 3 + 1;
    return { start: parisMidnight(year, first, 1), end: parisMidnight(year, first + 3, 1) };
  }
  return { start: parisMidnight(year, index, 1), end: parisMidnight(year, index + 1, 1) };
}

/** « 2026-12-01T09:30 » (saisie datetime-local, heure de Paris) → instant UTC. */
export function parisLocalToDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const midnight = parisMidnight(y, mo, d);
  return new Date(midnight.getTime() + (h * 60 + mi) * 60_000);
}

/** Instant UTC → valeur de champ datetime-local en heure de Paris. */
export function dateToParisLocalInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return parts.replace(" ", "T");
}
