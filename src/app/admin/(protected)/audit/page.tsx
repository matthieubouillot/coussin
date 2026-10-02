import { z } from "zod";
import { Card, inputClass, PageTitle, secondaryButtonClass } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Europe/Paris",
});

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireAdmin();
  const action = z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9._]*$/)
    .optional()
    .catch(undefined)
    .parse((await searchParams).action);
  const [entries, users] = await Promise.all([
    db.auditLog.findMany({
      where: action ? { action: { startsWith: action } } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.user.findMany({ select: { id: true, email: true } }),
  ]);
  const emailOf = new Map(users.map((u) => [u.id, u.email]));

  return (
    <>
      <PageTitle>Journal d&apos;audit</PageTitle>
      <Card>
        <form method="get" className="flex items-end gap-3">
          <label className="text-sm">
            Action commençant par (ex. admin.login, order.refund)
            <input name="action" defaultValue={action} className={inputClass} />
          </label>
          <button type="submit" className={secondaryButtonClass}>
            Filtrer
          </button>
        </form>
      </Card>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="p-2">Date</th>
              <th className="p-2">Action</th>
              <th className="p-2">Auteur</th>
              <th className="p-2">Cible</th>
              <th className="p-2">Détails</th>
              <th className="p-2">IP (hachée)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-stone-100 align-top">
                <td className="p-2 whitespace-nowrap">{dateTime.format(e.createdAt)}</td>
                <td className="p-2 font-mono">{e.action}</td>
                <td className="p-2">{e.actorId ? (emailOf.get(e.actorId) ?? e.actorId) : "—"}</td>
                <td className="p-2">{e.targetType ? `${e.targetType} ${e.targetId ?? ""}` : "—"}</td>
                <td className="p-2 font-mono text-xs">{e.metadata ? JSON.stringify(e.metadata) : ""}</td>
                <td className="p-2 font-mono text-xs">{e.ipHash?.slice(0, 10) ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
