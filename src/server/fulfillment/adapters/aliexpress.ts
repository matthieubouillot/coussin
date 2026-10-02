import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { toPlainLatin } from "@/server/fulfillment/address";
import { loadTokens, saveTokens } from "@/server/fulfillment/credentials";
import { decimalToCents, supplierFetch, universalTrackingUrl } from "@/server/fulfillment/http";
import { mapAliExpressStatus, signAliExpress } from "@/server/fulfillment/adapters/aliexpress-protocol";
import {
  SupplierError,
  type OfferRef,
  type SupplierAdapter,
  type SupplierProductVariant,
} from "@/server/fulfillment/types";

/**
 * Adaptateur AliExpress Open Platform (API Dropshipping).
 *
 * Sources : documentation AliExpress Open Platform (rendue en JavaScript, non lisible
 * automatiquement) recoupée avec le SDK communautaire ae_sdk. Les formats de réponse sont validés
 * de façon tolérante (Zod) et DOIVENT être revérifiés avec un vrai compte développeur avant la mise
 * en production (voir TODO_MATTHIEU.md).
 */

const TOP_URL = "https://api-sg.aliexpress.com/sync";
const OP_URL = "https://api-sg.aliexpress.com/rest";

function credentials() {
  const { ALIEXPRESS_APP_KEY: appKey, ALIEXPRESS_APP_SECRET: appSecret } = env();
  if (!appKey || !appSecret) throw new SupplierError("NOT_CONFIGURED", "API AliExpress non configurée");
  return { appKey, appSecret };
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  expire_time: z.coerce.number().optional(),
  refresh_token_valid_time: z.coerce.number().optional(),
});

/** Échange le code OAuth (retour d'autorisation du vendeur) contre des jetons, stockés chiffrés. */
export async function exchangeAuthorizationCode(code: string): Promise<void> {
  const { appKey, appSecret } = credentials();
  const path = "/auth/token/create";
  const params: Record<string, string> = {
    app_key: appKey,
    code,
    sign_method: "sha256",
    timestamp: String(Date.now()),
  };
  params.sign = signAliExpress(params, appSecret, path);
  const body = await supplierFetch(
    `${OP_URL}${path}?${new URLSearchParams(params)}`,
    { method: "POST" },
    { mutating: false },
  );
  const parsed = tokenResponseSchema.safeParse(body);
  if (!parsed.success)
    throw new SupplierError("NOT_CONFIGURED", "AliExpress a refusé le code d'autorisation");
  await saveTokens("ALIEXPRESS", {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? null,
    accessExpiresAt: parsed.data.expire_time ? new Date(parsed.data.expire_time) : null,
    refreshExpiresAt: parsed.data.refresh_token_valid_time
      ? new Date(parsed.data.refresh_token_valid_time)
      : null,
  });
}

export function authorizationUrl(redirectUri: string, state: string): string {
  const { appKey } = credentials();
  const params = new URLSearchParams({
    response_type: "code",
    force_auth: "true",
    redirect_uri: redirectUri,
    client_id: appKey,
    state,
  });
  return `https://api-sg.aliexpress.com/oauth/authorize?${params}`;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { appKey, appSecret } = credentials();
  const path = "/auth/token/refresh";
  const params: Record<string, string> = {
    app_key: appKey,
    refresh_token: refreshToken,
    sign_method: "sha256",
    timestamp: String(Date.now()),
  };
  params.sign = signAliExpress(params, appSecret, path);
  const body = await supplierFetch(
    `${OP_URL}${path}?${new URLSearchParams(params)}`,
    { method: "POST" },
    { mutating: false },
  );
  const parsed = tokenResponseSchema.safeParse(body);
  if (!parsed.success) throw new SupplierError("NOT_CONFIGURED", "Renouvellement du jeton AliExpress refusé");
  await saveTokens("ALIEXPRESS", {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? refreshToken,
    accessExpiresAt: parsed.data.expire_time ? new Date(parsed.data.expire_time) : null,
    refreshExpiresAt: parsed.data.refresh_token_valid_time
      ? new Date(parsed.data.refresh_token_valid_time)
      : null,
  });
  return parsed.data.access_token;
}

/** Jeton d'accès valide : stocké (chiffré) et renouvelé 1 h avant expiration ; sinon jeton initial de l'env. */
async function accessToken(forceRefresh = false): Promise<string> {
  const stored = await loadTokens("ALIEXPRESS");
  const refresh = stored?.refreshToken ?? env().ALIEXPRESS_REFRESH_TOKEN;
  const expiresSoon = stored?.accessExpiresAt
    ? stored.accessExpiresAt.getTime() - Date.now() < 3_600_000
    : false;
  if (refresh && (forceRefresh || expiresSoon)) return refreshAccessToken(refresh);
  const token = stored?.accessToken ?? env().ALIEXPRESS_ACCESS_TOKEN;
  if (!token) throw new SupplierError("NOT_CONFIGURED", "Jeton d'accès AliExpress absent");
  return token;
}

const errorResponseSchema = z.object({
  error_response: z.object({
    code: z.union([z.string(), z.number()]).optional(),
    msg: z.string().optional(),
    sub_code: z.string().optional(),
  }),
});

/** Retire l'enveloppe « xxx_response » si présente et renvoie son contenu. */
function unwrap(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object") {
    const key = Object.keys(body).find((k) => k.endsWith("_response"));
    if (key) return (body as Record<string, Record<string, unknown>>)[key] ?? {};
    return body as Record<string, unknown>;
  }
  return {};
}

async function call(
  method: string,
  business: Record<string, string>,
  options: { mutating: boolean },
  retried = false,
) {
  const { appKey, appSecret } = credentials();
  const params: Record<string, string> = {
    ...business,
    method,
    app_key: appKey,
    session: await accessToken(),
    sign_method: "sha256",
    timestamp: String(Date.now()),
    simplify: "true",
    format: "json",
  };
  params.sign = signAliExpress(params, appSecret);
  const body = await supplierFetch(`${TOP_URL}?${new URLSearchParams(params)}`, { method: "POST" }, options);

  const error = errorResponseSchema.safeParse(body);
  if (error.success) {
    // Erreur de passerelle : la requête n'a pas été traitée, un réessai est sans risque.
    const code = `${error.data.error_response.code ?? ""} ${error.data.error_response.sub_code ?? ""}`;
    if (/session|token|27/i.test(code) && !retried) {
      await accessToken(true);
      return call(method, business, options, true);
    }
    if (/limit|flow|frequency|7\b/i.test(code))
      throw new SupplierError("TRANSIENT", `AliExpress : quota (${code.trim()})`);
    throw new SupplierError("PERMANENT", `AliExpress : ${error.data.error_response.msg ?? code.trim()}`);
  }
  return unwrap(body);
}

// ── Produits ──────────────────────────────────────────────────────────

const skuSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    sku_attr: z.string().optional(),
    offer_sale_price: z.union([z.string(), z.number()]).optional(),
    sku_price: z.union([z.string(), z.number()]).optional(),
    sku_available_stock: z.coerce.number().optional(),
    s_k_u_available_stock: z.coerce.number().optional(),
    ipm_sku_stock: z.coerce.number().optional(),
    currency_code: z.string().optional(),
    aeop_s_k_u_propertys: z
      .array(
        z.object({
          sku_property_id: z.coerce.number(),
          property_value_id: z.coerce.number().optional(),
          property_value_id_long: z.coerce.number().optional(),
          sku_property_value: z.string().optional(),
          property_value_definition_name: z.string().optional(),
        }),
      )
      .optional(),
  })
  .loose();

const productSchema = z
  .object({
    result: z
      .object({
        ae_item_base_info_dto: z.object({ subject: z.string() }).loose().optional(),
        ae_item_sku_info_dtos: z.union([
          z.array(skuSchema),
          z.object({ ae_item_sku_info_d_t_o: z.array(skuSchema) }),
        ]),
      })
      .loose(),
  })
  .loose();

/** Identifiant de variante utilisé à la commande (sku_attr), ex. « 14:193#Gris;5:100014064 ». */
function skuAttr(sku: z.infer<typeof skuSchema>): string {
  if (sku.sku_attr) return sku.sku_attr;
  return (sku.aeop_s_k_u_propertys ?? [])
    .map((p) => {
      const value = p.property_value_id_long ?? p.property_value_id;
      return `${p.sku_property_id}:${value}${p.property_value_definition_name ? `#${p.property_value_definition_name}` : ""}`;
    })
    .join(";");
}

async function fetchProduct(productId: string) {
  const result = await call(
    "aliexpress.ds.product.get",
    { product_id: productId, ship_to_country: "FR", target_currency: "EUR", target_language: "FR" },
    { mutating: false },
  );
  const parsed = productSchema.safeParse(result);
  if (!parsed.success) throw new SupplierError("PERMANENT", "Réponse produit AliExpress inattendue");
  const raw = parsed.data.result.ae_item_sku_info_dtos;
  const skus = Array.isArray(raw) ? raw : raw.ae_item_sku_info_d_t_o;
  return { title: parsed.data.result.ae_item_base_info_dto?.subject ?? "", skus };
}

function toVariant(sku: z.infer<typeof skuSchema>): SupplierProductVariant {
  return {
    skuId: skuAttr(sku),
    label: (sku.aeop_s_k_u_propertys ?? [])
      .map((p) => p.property_value_definition_name ?? p.sku_property_value)
      .filter(Boolean)
      .join(" / "),
    stock: sku.sku_available_stock ?? sku.s_k_u_available_stock ?? sku.ipm_sku_stock ?? null,
    unitCost: decimalToCents(sku.offer_sale_price ?? sku.sku_price),
    currency: sku.currency_code ?? "EUR",
  };
}

// ── Commandes ─────────────────────────────────────────────────────────

const placeOrderSchema = z
  .object({
    result: z
      .object({
        is_success: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "true"),
        order_list: z
          .union([
            z.array(z.union([z.number(), z.string()])),
            z.object({ number: z.array(z.union([z.number(), z.string()])) }),
          ])
          .optional(),
        error_code: z.string().optional(),
        error_msg: z.string().optional(),
      })
      .loose(),
  })
  .loose();

const OUT_OF_STOCK_CODES = new Set(["INVENTORY_HOLD_ERROR"]);

const orderSchema = z
  .object({
    result: z
      .object({
        order_status: z.string().optional(),
        logistics_status: z.string().optional(),
        order_amount: z
          .object({ amount: z.union([z.string(), z.number()]) })
          .loose()
          .optional(),
        logistics_info_list: z
          .union([
            z.array(z.object({ logistics_no: z.string(), logistics_service: z.string().optional() }).loose()),
            z.object({
              ae_order_logistics_info: z.array(
                z.object({ logistics_no: z.string(), logistics_service: z.string().optional() }).loose(),
              ),
            }),
          ])
          .optional(),
      })
      .loose(),
  })
  .loose();

async function fetchOrder(externalOrderId: string) {
  const result = await call(
    "aliexpress.trade.ds.order.get",
    { single_order_query: JSON.stringify({ order_id: externalOrderId }) },
    { mutating: false },
  );
  const parsed = orderSchema.safeParse(result);
  if (!parsed.success) throw new SupplierError("TRANSIENT", "Réponse commande AliExpress inattendue");
  return parsed.data.result;
}

export const aliexpressAdapter: SupplierAdapter = {
  kind: "ALIEXPRESS",

  async getProduct(externalProductId) {
    const product = await fetchProduct(externalProductId);
    return { title: product.title, variants: product.skus.map(toVariant) };
  },

  async getStockAndPrice(offer: OfferRef) {
    if (!offer.externalProductId)
      throw new SupplierError("PERMANENT", "Offre sans identifiant produit AliExpress");
    const product = await fetchProduct(offer.externalProductId);
    const sku = offer.externalSkuId
      ? product.skus.find((s) => skuAttr(s) === offer.externalSkuId)
      : product.skus[0];
    if (!sku) throw new SupplierError("OUT_OF_STOCK", "Variante introuvable chez AliExpress (retirée ?)");
    const variant = toVariant(sku);
    return { stock: variant.stock, unitCost: variant.unitCost, currency: "EUR" as const };
  },

  async placeOrder(request) {
    if (!request.offer.externalProductId)
      throw new SupplierError("PERMANENT", "Offre sans identifiant produit AliExpress");
    const settings = await db.shopSettings.findUnique({
      where: { id: "singleton" },
      select: { aliexpressAutoPay: true },
    });
    const a = request.address;
    const order = {
      out_order_id: request.reference,
      logistics_address: {
        full_name: toPlainLatin(a.fullName),
        contact_person: toPlainLatin(a.fullName),
        address: toPlainLatin(a.line1),
        address2: a.line2 ? toPlainLatin(a.line2) : undefined,
        city: toPlainLatin(a.city),
        province: toPlainLatin(a.city),
        zip: a.postalCode,
        country: a.countryCode,
        phone_country: "+33",
        mobile_no: a.phone.replace(/^\+33/, "0"),
        locale: "fr_FR",
      },
      product_items: [
        {
          product_id: Number(request.offer.externalProductId),
          product_count: request.quantity,
          sku_attr: request.offer.externalSkuId ?? undefined,
          logistics_service_name: request.offer.shippingMethod ?? undefined,
          order_memo: `Ref ${request.reference}`,
        },
      ],
    };
    const result = await call(
      "aliexpress.ds.order.create",
      {
        param_place_order_request4_open_api_d_t_o: JSON.stringify(order),
        ds_extend_request: JSON.stringify({
          payment: {
            pay_currency: "EUR",
            try_to_pay: settings?.aliexpressAutoPay === false ? "false" : "true",
          },
        }),
      },
      { mutating: true },
    );

    const parsed = placeOrderSchema.safeParse(result);
    // Réponse illisible après une création : on ne sait pas si la commande existe.
    if (!parsed.success)
      throw new SupplierError("AMBIGUOUS", "Réponse de création de commande AliExpress illisible");
    const r = parsed.data.result;
    if (!r.is_success) {
      const code = r.error_code ?? "";
      if (OUT_OF_STOCK_CODES.has(code)) throw new SupplierError("OUT_OF_STOCK", `AliExpress : ${code}`);
      if (code === "REPEATED_ORDER_ERROR")
        throw new SupplierError("AMBIGUOUS", "AliExpress signale une commande en double");
      throw new SupplierError("PERMANENT", `AliExpress : ${code} ${r.error_msg ?? ""}`.trim());
    }
    const ids = Array.isArray(r.order_list) ? r.order_list : (r.order_list?.number ?? []);
    const externalOrderId = ids.map(String).join(",");
    if (!externalOrderId)
      throw new SupplierError("AMBIGUOUS", "AliExpress n'a renvoyé aucun numéro de commande");

    // Le paiement automatique a-t-il abouti ? Vérification immédiate, sans bloquer en cas d'échec.
    let payment: "PAID" | "AWAITING_PAYMENT" = "AWAITING_PAYMENT";
    let totalCostCents: number | null = null;
    try {
      const status = await fetchOrder(ids.map(String)[0]!);
      if (mapAliExpressStatus(status.order_status, status.logistics_status) !== "AWAITING_PAYMENT")
        payment = "PAID";
      totalCostCents = decimalToCents(status.order_amount?.amount);
    } catch {
      // Le cron de suivi rectifiera le statut.
    }
    return { externalOrderId, payment, totalCostCents };
  },

  async getOrderStatus(externalOrderId) {
    const order = await fetchOrder(externalOrderId.split(",")[0]!);
    return mapAliExpressStatus(order.order_status, order.logistics_status);
  },

  async getTracking(externalOrderId) {
    const order = await fetchOrder(externalOrderId.split(",")[0]!);
    const raw = order.logistics_info_list;
    const list = Array.isArray(raw) ? raw : (raw?.ae_order_logistics_info ?? []);
    const first = list[0];
    if (!first) return null;
    return {
      trackingNumber: first.logistics_no,
      carrier: first.logistics_service ?? null,
      trackingUrl: universalTrackingUrl(first.logistics_no),
      delivered: mapAliExpressStatus(order.order_status, order.logistics_status) === "DELIVERED",
    };
  },

  async cancelOrder() {
    throw new SupplierError("NOT_SUPPORTED", "Annulation à faire sur AliExpress (pas d'API publique)");
  },
};
