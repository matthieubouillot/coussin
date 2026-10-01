import type { ReactNode } from "react";

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <main className="legal mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-cocoa font-serif text-4xl">{title}</h1>
      <p className="text-ink/70 mt-2 text-sm">Dernière mise à jour : {updatedAt}</p>
      {children}
    </main>
  );
}

/** Affiche une information de l'identité légale, mise en évidence si c'est encore un placeholder. */
export function Info({ children }: { children: string }) {
  if (children.includes("[À COMPLÉTER")) {
    return <mark className="bg-yellow-200 px-1">{children}</mark>;
  }
  return <>{children}</>;
}
