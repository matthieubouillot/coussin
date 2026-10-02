import Link from "next/link";
import { z } from "zod";
import { Card, inputClass, PageTitle, secondaryButtonClass } from "@/components/admin/ui";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { formatEuros } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";
import { adminHref } from "@/server/auth/admin-path";
import { requireAdmin } from "@/server/auth/require-admin";
import { db } from "@/server/db";

const PAGE_SIZE = 25;
const STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

const filtersSchema = z.object({
  statut: z
    .enum([...STATUSES, "a-payer"])
    .optional()
    .catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export default async function OrdersPage({ searchParams }: PageProps<"/admin/commandes">) {
  await requireAdmin();
  const filters = filtersSchema.parse(await searchParams);

  const where: Prisma.OrderWhereInput = {
    // Les paniers abandonnés (jamais payés) n'encombrent pas la liste, sauf filtre explicite.
    ...(filters.statut === "a-payer"
      ? { supplierOrders: { some: { status: "AWAITING_SUPPLIER_PAYMENT" } } }
      : filters.statut
        ? { status: filters.statut }
        : { status: { not: "PENDING_PAYMENT" } }),
    ...(filters.q
      ? {
          OR: [
            { number: { contains: filters.q.toUpperCase() } },
            { email: { contains: filters.q.toLowerCase() } },
            { shippingName: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        email: true,
        shippingName: true,
        totalCents: true,
        createdAt: true,
        utmSource: true,
        utmCampaign: true,
      },
    }),
    db.order.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (filters.statut) params.set("statut", filters.statut);
    if (filters.q) params.set("q", filters.q);
    params.set("page", String(page));
    return adminHref(`/commandes?${params}`);
  };

  return (
    <>
      <PageTitle>Commandes ({total})</PageTitle>
      <Card>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="text-sm">
            Statut
            <select name="statut" defaultValue={filters.statut ?? ""} className={inputClass}>
              <option value="">Toutes (hors non payées)</option>
              <option value="a-payer">À payer chez le fournisseur</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Recherche (n°, email, nom)
            <input name="q" defaultValue={filters.q} className={inputClass} />
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
              <th className="p-3">N°</th>
              <th className="p-3">Date</th>
              <th className="p-3">Client</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Source</th>
              <th className="p-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-stone-100">
                <td className="p-3 font-mono">
                  <Link href={adminHref(`/commandes/${o.id}`)} className="underline">
                    {o.number}
                  </Link>
                </td>
                <td className="p-3">{dateTime.format(o.createdAt)}</td>
                <td className="p-3">{o.shippingName ?? o.email}</td>
                <td className="p-3">{ORDER_STATUS_LABELS[o.status]}</td>
                <td className="p-3 text-stone-500">
                  {[o.utmSource, o.utmCampaign].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="p-3 text-right">{formatEuros(o.totalCents)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-stone-500">
                  Aucune commande.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex gap-3 text-sm">
          {filters.page > 1 && <Link href={pageHref(filters.page - 1)}>← Précédente</Link>}
          <span>
            Page {filters.page} / {pages}
          </span>
          {filters.page < pages && <Link href={pageHref(filters.page + 1)}>Suivante →</Link>}
        </nav>
      )}
    </>
  );
}
