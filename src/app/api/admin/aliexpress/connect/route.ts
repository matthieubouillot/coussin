import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getAdminOrNull } from "@/server/auth/require-admin";
import { env } from "@/server/env";
import { authorizationUrl } from "@/server/fulfillment/adapters/aliexpress";

const STATE_COOKIE = "adm_ae_oauth_state";

// Démarre l'autorisation OAuth AliExpress (compte vendeur → accès à l'API dropshipping).
export async function GET(): Promise<Response> {
  const admin = await getAdminOrNull();
  if (!admin) return new Response("Introuvable", { status: 404 });
  // Jeton anti-CSRF : le retour d'AliExpress n'est accepté que s'il rapporte cette valeur.
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/admin/aliexpress",
    maxAge: 600,
  });
  try {
    return Response.redirect(
      authorizationUrl(`${env().NEXT_PUBLIC_SITE_URL}/api/admin/aliexpress/callback`, state),
      302,
    );
  } catch {
    return new Response("API AliExpress non configurée (ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET)", {
      status: 503,
    });
  }
}
