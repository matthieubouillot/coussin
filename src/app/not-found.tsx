import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-cocoa font-serif text-3xl">Page introuvable</h1>
      <p>La page demandée n&apos;existe pas ou a été déplacée.</p>
      <Link href="/" className="text-sage underline underline-offset-4">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
