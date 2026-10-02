import "server-only";
import { periodOf } from "@/lib/paris-time";
import { cashedRevenue } from "@/server/admin/revenue";
import { db } from "@/server/db";
import { notifyAdmin } from "@/server/email/admin-alerts";

export type ThresholdStatus = {
  label: string;
  currentCents: number;
  limitCents: number;
  percent: number;
  alert: boolean;
};

/**
 * Comparaison du chiffre d'affaires encaissé de l'année civile aux seuils saisis dans l'admin
 * (plafond micro-entreprise vente, seuil de franchise de TVA). Aucune valeur n'est codée en dur :
 * ces montants changent régulièrement.
 */
export async function thresholdStatus(): Promise<ThresholdStatus[]> {
  const settings = await db.shopSettings.findUnique({ where: { id: "singleton" } });
  if (!settings) return [];
  const { netCents } = await cashedRevenue(periodOf("year"));
  const ratio = settings.thresholdAlertRatioBps / 10_000;

  const entries: [string, number | null][] = [
    ["Plafond micro-entreprise (vente)", settings.microRevenueCeilingCents],
    ["Seuil de franchise en base de TVA", settings.vatFranchiseThresholdCents],
  ];
  return entries
    .filter((e): e is [string, number] => e[1] !== null && e[1] > 0)
    .map(([label, limitCents]) => ({
      label,
      currentCents: netCents,
      limitCents,
      percent: Math.round((netCents / limitCents) * 100),
      alert: netCents >= limitCents * ratio,
    }));
}

/** Appelé chaque jour par un cron : une alerte email par seuil et par année. */
export async function alertOnThresholds(): Promise<void> {
  const year = new Date().getFullYear();
  for (const t of await thresholdStatus()) {
    if (!t.alert) continue;
    await notifyAdmin(`threshold:${t.label}:${year}`, `Seuil bientôt atteint : ${t.label}`, [
      `Encaissé depuis le 1er janvier : ${(t.currentCents / 100).toFixed(2)} € (${t.percent} % du seuil).`,
      "Vérifier avec l'URSSAF / le service des impôts les conséquences (sortie du régime, TVA).",
    ]);
  }
}
