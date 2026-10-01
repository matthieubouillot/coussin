import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Coquille de la phase 1 : sert uniquement à vérifier le masquage du chemin admin.
// L'authentification + 2FA arrive en phase 4 ; aucune donnée n'est exposée ici.
export default function AdminHome() {
  return (
    <main className="p-6">
      <h1 className="font-serif text-2xl">Administration</h1>
      <p>Authentification à venir (phase 4).</p>
    </main>
  );
}
