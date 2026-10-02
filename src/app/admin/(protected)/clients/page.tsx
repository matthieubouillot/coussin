import Link from "next/link";
import { z } from "zod";
import { Card, inputClass, PageTitle, secondaryButtonClass } from "@/components/admin/ui";
import { formatEuros } from "@/lib/money";
import { adminHref } from "@/server/auth/admin-path";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";

export default async function CustomersPage({ searchParams }: PageProps<"/admin/clients">) {
  await requireAdmin();
  const q = z
    .string()
    .trim()
    .max(100)
    .optional()
    .catch(undefined)
    .parse((await searchParams).q);
  const customers = await db.customer.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q.toLowerCase() } },
            { lastName: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { orders: { where: { paidAt: { not: null } }, select: { totalCents: true } } },
  });

  return (
    <>
      <PageTitle>Clients</PageTitle>
      <Card>
        <form method="get" className="flex items-end gap-3">
          <label className="text-sm">
            Recherche (email, nom)
            <input name="q" defaultValue={q} className={inputClass} />
          </label>
          <button type="submit" className={secondaryButtonClass}>
            Rechercher
          </button>
        </form>
      </Card>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="p-3">Client</th>
              <th className="p-3">Email</th>
              <th className="p-3">Commandes</th>
              <th className="p-3 text-right">Total payé</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-stone-100">
                <td className="p-3">
                  <Link href={adminHref(`/clients/${c.id}`)} className="underline">
                    {c.anonymizedAt
                      ? "Client anonymisé"
                      : [c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                  </Link>
                </td>
                <td className="p-3">{c.anonymizedAt ? "—" : c.email}</td>
                <td className="p-3">{c.orders.length}</td>
                <td className="p-3 text-right">
                  {formatEuros(c.orders.reduce((s, o) => s + o.totalCents, 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
