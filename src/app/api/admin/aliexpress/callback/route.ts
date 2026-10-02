import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { audit } from "@/server/audit/audit";
import { adminHref } from "@/server/auth/admin-path";
import { getAdminOrNull } from "@/server/auth/require-admin";
import { env } from "@/server/env";
import { exchangeAuthorizationCode } from "@/server/fulfillment/adapters/aliexpress";

const STATE_COOKIE = "adm_ae_oauth_state";

export async function GET(request: Request): Promise<Response> {
  const admin = await getAdminOrNull();
  if (!admin) return new Response("Introuvable", { status: 404 });

  const params = new URL(request.url).searchParams;
  const parsed = z
    .object({ code: z.string().min(1).max(500), state: z.string().min(10).max(100) })
    .safeParse(Object.fromEntries(params));
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value ?? "";
  store.delete({ name: STATE_COOKIE, path: "/api/admin/aliexpress" });

  const back = (status: string) =>
    Response.redirect(`${env().NEXT_PUBLIC_SITE_URL}${adminHref(`/reglages?aliexpress=${status}`)}`, 302);
  if (
    !parsed.success ||
    expected.length !== parsed.data.state.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.data.state))
  ) {
    return back("refus");
  }
  try {
    await exchangeAuthorizationCode(parsed.data.code);
    await audit("supplier.aliexpress.connected", { actorId: admin.id });
    return back("connecte");
  } catch {
    return back("erreur");
  }
}
