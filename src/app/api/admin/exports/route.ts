import { z } from "zod";
import { accountingPeriod } from "@/lib/paris-time";
import { purchaseRegisterCsv, salesLedgerCsv } from "@/server/accounting/exports";
import { audit } from "@/server/audit/audit";
import { getAdminOrNull } from "@/server/auth/require-admin";

const querySchema = z.discriminatedUnion("periode", [
  z.object({
    registre: z.enum(["recettes", "achats"]),
    annee: z.coerce.number().int().min(2020).max(2100),
    periode: z.literal("annee"),
  }),
  z.object({
    registre: z.enum(["recettes", "achats"]),
    annee: z.coerce.number().int().min(2020).max(2100),
    periode: z.literal("trimestre"),
    index: z.coerce.number().int().min(1).max(4),
  }),
  z.object({
    registre: z.enum(["recettes", "achats"]),
    annee: z.coerce.number().int().min(2020).max(2100),
    periode: z.literal("mois"),
    index: z.coerce.number().int().min(1).max(12),
  }),
]);

export async function GET(request: Request): Promise<Response> {
  const admin = await getAdminOrNull();
  if (!admin) return new Response("Introuvable", { status: 404 });

  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return new Response("Paramètres invalides", { status: 400 });
  const q = query.data;

  const kind = q.periode === "annee" ? "year" : q.periode === "trimestre" ? "quarter" : "month";
  const index = q.periode === "annee" ? 1 : q.index;
  const period = accountingPeriod(q.annee, kind, index);
  const csv = q.registre === "recettes" ? await salesLedgerCsv(period) : await purchaseRegisterCsv(period);

  const suffix =
    q.periode === "annee" ? `${q.annee}` : `${q.annee}-${q.periode === "trimestre" ? "T" : "M"}${index}`;
  await audit("accounting.export", {
    actorId: admin.id,
    metadata: { registre: q.registre, periode: suffix },
  });
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${q.registre === "recettes" ? "livre-des-recettes" : "registre-des-achats"}-${suffix}.csv"`,
      "cache-control": "no-store",
    },
  });
}
