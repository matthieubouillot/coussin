import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import { resolveAdminRouting } from "@/lib/security/admin-path";

// Proxy volontairement léger (recommandation Next 16) : nonce CSP + masquage de l'admin.
// Aucune décision d'autorisation ici : elle est prise côté serveur, au plus près des données.
export function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const routing = resolveAdminRouting(request.nextUrl.pathname, process.env.ADMIN_PATH);
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    admin: routing.kind === "rewrite",
  });

  // Next.js lit la CSP de la requête pour appliquer le nonce à ses propres scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response: NextResponse;
  if (routing.kind === "not-found") {
    // Route inexistante : Next affiche la page 404 standard, sans révéler l'admin.
    response = NextResponse.rewrite(new URL("/__introuvable", request.url), {
      request: { headers: requestHeaders },
    });
  } else if (routing.kind === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = routing.internalPath;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "no-store");
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Exclut les routes API (webhooks, jobs : pas de HTML), les assets statiques,
      // le tunnel Sentry et les préchargements de next/link.
      source: "/((?!api|monitoring|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
