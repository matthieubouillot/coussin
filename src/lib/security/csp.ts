/**
 * Construction de la Content-Security-Policy.
 *
 * Fonction pure (testée) appelée par `src/proxy.ts` à chaque requête avec un nonce neuf.
 * Chaque service tiers ajouté dans les phases suivantes (Stripe, Turnstile, TikTok…)
 * doit être déclaré ici explicitement, directive par directive : rien n'est autorisé par défaut.
 */

type Directives = Record<string, string[]>;

// Domaines des régies publicitaires : autorisés UNIQUEMENT quand le visiteur a consenti.
const ADS_CONNECT = [
  "https://analytics.tiktok.com",
  "https://*.tiktok.com",
  "https://www.facebook.com",
  "https://connect.facebook.net",
];
const ADS_IMG = ["https://analytics.tiktok.com", "https://www.facebook.com"];

export function buildCsp({
  nonce,
  isDev,
  admin = false,
  ads = false,
  blobHost = "*.public.blob.vercel-storage.com",
}: {
  nonce: string;
  isDev: boolean;
  admin?: boolean;
  ads?: boolean;
  /** Hôte public de notre espace Vercel Blob (photos et vidéos produit). */
  blobHost?: string;
}): string {
  const directives: Directives = {
    "default-src": ["'self'"],
    // 'strict-dynamic' : seuls les scripts portant le nonce (et ceux qu'ils chargent) s'exécutent.
    // 'unsafe-eval' uniquement en dev : React l'utilise pour reconstruire les piles d'erreur.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // En dev, l'overlay de Next.js injecte des <style> sans nonce. Un nonce rendant 'unsafe-inline'
    // inopérant, on ne met que 'unsafe-inline' en dev ; la production exige le nonce.
    "style-src": isDev ? ["'self'", "'unsafe-inline'"] : ["'self'", `'nonce-${nonce}'`],
    // Attributs style="" (next/image, positionnement React) : sans exécution de code, risque faible,
    // et impossibles à couvrir par un nonce. Les balises <style> restent soumises au nonce.
    "style-src-attr": ["'unsafe-inline'"],
    // Vercel Blob héberge les photos et vidéos produit (phase 2).
    "img-src": ["'self'", "blob:", "data:", `https://${blobHost}`, ...(ads ? ADS_IMG : [])],
    "media-src": ["'self'", `https://${blobHost}`],
    "font-src": ["'self'"],
    // Sentry passe par un tunnel same-origin (/monitoring) : pas besoin d'autoriser son domaine.
    "connect-src": [
      "'self'",
      ...(isDev ? ["ws:"] : []),
      // Admin uniquement : envoi direct des photos/vidéos du navigateur vers Vercel Blob.
      ...(admin ? ["https://vercel.com", "https://*.blob.vercel-storage.com"] : []),
      ...(ads ? ADS_CONNECT : []),
    ],
    // Cloudflare Turnstile (anti-robot des formulaires publics) s'affiche dans une iframe.
    "frame-src": ["https://challenges.cloudflare.com"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // Le bouton de commande redirige vers la page de paiement hébergée par Stripe.
    "form-action": ["'self'", "https://checkout.stripe.com"],
    "frame-ancestors": ["'none'"],
    ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
  };

  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

/** Nonce imprévisible et unique par requête (128 bits d'aléa). */
export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
