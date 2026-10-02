import Link from "next/link";
import { logoutAction } from "@/app/admin/auth-actions";
import { adminHref } from "@/server/auth/admin-path";
import { requireAdmin } from "@/server/auth/require-admin";

const NAV = [
  ["", "Tableau de bord"],
  ["/commandes", "Commandes"],
  ["/produit", "Produit"],
  ["/clients", "Clients"],
  ["/promos", "Codes promo"],
  ["/livraison", "Livraison et lots"],
  ["/avis", "Avis"],
  ["/comptabilite", "Comptabilité"],
  ["/reglages", "Réglages"],
  ["/securite", "Sécurité"],
  ["/audit", "Journal d'audit"],
] as const;

export default async function ProtectedAdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();
  return (
    <div className="lg:flex">
      <nav
        aria-label="Administration"
        className="border-b border-stone-200 bg-white p-4 lg:min-h-dvh lg:w-56 lg:border-r lg:border-b-0"
      >
        <p className="text-cocoa mb-4 font-serif text-lg">Administration</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm lg:flex-col">
          {NAV.map(([path, label]) => (
            <li key={path}>
              <Link href={adminHref(path)} className="hover:underline">
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <form action={logoutAction} className="mt-6 text-sm">
          <p className="mb-1 truncate text-stone-500">{admin.email}</p>
          <button type="submit" className="underline">
            Se déconnecter
          </button>
        </form>
      </nav>
      <main className="flex-1 p-4 lg:p-8">{children}</main>
    </div>
  );
}
