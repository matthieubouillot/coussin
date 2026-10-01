import "server-only";
import type { EmailShop } from "@/emails/EmailLayout";
import { env } from "@/server/env";
import { getShopConfig } from "@/server/settings/settings";

export async function emailShop(): Promise<EmailShop> {
  const config = await getShopConfig();
  return {
    shopName: config.shopName,
    sellerName: config.legal.sellerName,
    address: config.legal.address,
    siret: config.legal.siret,
    email: config.legal.email,
    siteUrl: env().NEXT_PUBLIC_SITE_URL,
  };
}
