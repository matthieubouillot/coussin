import "server-only";
import { z } from "zod";
import { env } from "@/server/env";
import { toPlainLatin } from "@/server/fulfillment/address";
import { loadTokens, saveTokens } from "@/server/fulfillment/credentials";
import { decimalToCents, supplierFetch, universalTrackingUrl } from "@/server/fulfillment/http";
import { mapCjStatus } from "@/server/fulfillment/adapters/cj-protocol";
import { SupplierError, type SupplierAdapter } from "@/server/fulfillment/types";

/**
 * Adaptateur CJ Dropshipping (API v2). Endpoints vérifiés dans la documentation officielle
 * (developers.cjdropshipping.cn, octobre 2026). Montants CJ en USD.
 * Hors production, les commandes sont créées en mode bac à sable (isSandbox=1) : aucun débit réel.
 */

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";

const envelope = z.object({
  code: z.coerce.number(),
  result: z.boolean().optional(),
  message: z.string().nullish(),
  data: z.unknown(),
});

const tokenSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiryDate: z.string().nullish(),
  refreshToken: z.string().nullish(),
  refreshTokenExpiryDate: z.string().nullish(),
});

async function fetchNewToken(): Promise<string> {
  const apiKey = env().CJ_API_KEY;
  if (!apiKey) throw new SupplierError("NOT_CONFIGURED", "API CJ non configurée (CJ_API_KEY)");
  const body = envelope.parse(
    await supplierFetch(
      `${BASE}/authentication/getAccessToken`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey }) },
      { mutating: false },
    ),
  );
  const token = tokenSchema.safeParse(body.data);
  if (body.code !== 200 || !token.success)
    throw new SupplierError("NOT_CONFIGURED", `CJ : authentification refusée (${body.message ?? body.code})`);
  await saveTokens("CJ", {
    accessToken: token.data.accessToken,
    refreshToken: token.data.refreshToken ?? null,
    accessExpiresAt: token.data.accessTokenExpiryDate ? new Date(token.data.accessTokenExpiryDate) : null,
    refreshExpiresAt: token.data.refreshTokenExpiryDate ? new Date(token.data.refreshTokenExpiryDate) : null,
  });
  return token.data.accessToken;
}

async function accessToken(force = false): Promise<string> {
  const stored = await loadTokens("CJ");
  const valid =
    stored && (!stored.accessExpiresAt || stored.accessExpiresAt.getTime() - Date.now() > 86_400_000);
  if (stored && valid && !force) return stored.accessToken;
  return fetchNewToken();
}

/** Codes CJ : 1600001 jeton invalide, 1600200 quota. Les autres refus sont définitifs. */
async function request(
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: unknown },
  mutating: boolean,
  retried = false,
): Promise<unknown> {
  const raw = await supplierFetch(
    `${BASE}${path}`,
    {
      method: init.method,
      headers: { "content-type": "application/json", "CJ-Access-Token": await accessToken() },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    },
    { mutating },
  );
  const body = envelope.safeParse(raw);
  if (!body.success) throw new SupplierError(mutating ? "AMBIGUOUS" : "TRANSIENT", "Réponse CJ illisible");
  if (body.data.code === 200) return body.data.data;

  const message = body.data.message ?? String(body.data.code);
  if (body.data.code === 1600001 && !retried) {
    await accessToken(true);
    return request(path, init, mutating, true);
  }
  if (body.data.code === 1600200 || /too many|limit/i.test(message))
    throw new SupplierError("TRANSIENT", `CJ : ${message}`);
  if (/stock|inventory/i.test(message)) throw new SupplierError("OUT_OF_STOCK", `CJ : ${message}`);
  throw new SupplierError("PERMANENT", `CJ : ${message}`);
}

const variantSchema = z.object({
  vid: z.coerce.string(),
  variantNameEn: z.string().nullish(),
  variantKey: z.string().nullish(),
  variantSellPrice: z.coerce.number().nullish(),
});

const stockSchema = z.array(
  z.object({ countryCode: z.string().nullish(), totalInventoryNum: z.coerce.number().nullish() }).loose(),
);

const orderDetailSchema = z
  .object({
    orderStatus: z.string().nullish(),
    trackNumber: z.string().nullish(),
    trackingProvider: z.string().nullish(),
    trackingUrl: z.string().nullish(),
    logisticName: z.string().nullish(),
  })
  .loose();

const trackSchema = z.array(
  z
    .object({
      trackingNumber: z.string(),
      trackingStatus: z.string().nullish(),
      lastMileCarrier: z.string().nullish(),
    })
    .loose(),
);

async function orderDetail(externalOrderId: string) {
  const data = await request(
    `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(externalOrderId)}`,
    { method: "GET" },
    false,
  );
  const parsed = orderDetailSchema.safeParse(data);
  if (!parsed.success) throw new SupplierError("TRANSIENT", "Détail de commande CJ inattendu");
  return parsed.data;
}

export const cjAdapter: SupplierAdapter = {
  kind: "CJ",

  async getProduct(pid) {
    const data = await request(
      `/product/variant/query?pid=${encodeURIComponent(pid)}`,
      { method: "GET" },
      false,
    );
    const variants = z.array(variantSchema).safeParse(data);
    if (!variants.success) throw new SupplierError("PERMANENT", "Liste de variantes CJ inattendue");
    return {
      title: pid,
      variants: variants.data.map((v) => ({
        skuId: v.vid,
        label: v.variantKey ?? v.variantNameEn ?? v.vid,
        stock: null,
        unitCost: decimalToCents(v.variantSellPrice),
        currency: "USD",
      })),
    };
  },

  async getStockAndPrice(offer) {
    if (!offer.externalSkuId)
      throw new SupplierError("PERMANENT", "Offre CJ sans identifiant de variante (vid)");
    const vid = encodeURIComponent(offer.externalSkuId);
    const [variantData, stockData] = [
      await request(`/product/variant/queryByVid?vid=${vid}`, { method: "GET" }, false),
      await request(`/product/stock/queryByVid?vid=${vid}`, { method: "GET" }, false),
    ];
    const variant = variantSchema.safeParse(variantData);
    const stock = stockSchema.safeParse(stockData);
    return {
      stock: stock.success ? stock.data.reduce((sum, w) => sum + (w.totalInventoryNum ?? 0), 0) : null,
      unitCost: variant.success ? decimalToCents(variant.data.variantSellPrice) : null,
      currency: "USD" as const,
    };
  },

  async placeOrder(req) {
    if (!req.offer.externalSkuId)
      throw new SupplierError("PERMANENT", "Offre CJ sans identifiant de variante (vid)");
    if (!req.offer.shippingMethod)
      throw new SupplierError("PERMANENT", "Offre CJ sans mode d'expédition (logisticName)");
    const a = req.address;
    const data = await request(
      "/shopping/order/createOrderV2",
      {
        method: "POST",
        body: {
          // Notre référence unique : CJ s'en sert comme numéro de commande de la boutique.
          orderNumber: req.reference,
          shippingCountryCode: "FR",
          shippingCountry: "France",
          shippingProvince: toPlainLatin(a.city),
          shippingCity: toPlainLatin(a.city),
          shippingZip: a.postalCode,
          shippingAddress: toPlainLatin(a.line1),
          shippingAddress2: a.line2 ? toPlainLatin(a.line2) : undefined,
          shippingCustomerName: toPlainLatin(a.fullName),
          shippingPhone: a.phone,
          logisticName: req.offer.shippingMethod,
          fromCountryCode: "CN",
          // 2 = paiement automatique par le solde du portefeuille CJ.
          payType: 2,
          isSandbox: env().VERCEL_ENV === "production" ? 0 : 1,
          products: [{ vid: req.offer.externalSkuId, quantity: req.quantity }],
        },
      },
      true,
    );
    const parsed = z
      .object({
        orderId: z.coerce.string().min(1),
        orderStatus: z.string().nullish(),
        actualPayment: z.union([z.string(), z.number()]).nullish(),
      })
      .loose()
      .safeParse(data);
    if (!parsed.success) throw new SupplierError("AMBIGUOUS", "CJ n'a pas renvoyé de numéro de commande");
    const state = mapCjStatus(parsed.data.orderStatus);
    return {
      externalOrderId: parsed.data.orderId,
      payment: state === "AWAITING_PAYMENT" ? ("AWAITING_PAYMENT" as const) : ("PAID" as const),
      // Montant en USD : converti par l'appelant avec le taux saisi dans l'admin.
      totalCostCents: null,
    };
  },

  async getOrderStatus(externalOrderId) {
    return mapCjStatus((await orderDetail(externalOrderId)).orderStatus);
  },

  async getTracking(externalOrderId) {
    const order = await orderDetail(externalOrderId);
    if (!order.trackNumber) return null;
    let delivered = mapCjStatus(order.orderStatus) === "DELIVERED";
    try {
      const track = trackSchema.safeParse(
        await request(
          `/logistic/trackInfo?trackNumber=${encodeURIComponent(order.trackNumber)}`,
          { method: "GET" },
          false,
        ),
      );
      if (track.success && /deliver/i.test(track.data[0]?.trackingStatus ?? "")) delivered = true;
    } catch {
      // Le statut de la commande suffit ; le suivi détaillé est un plus.
    }
    return {
      trackingNumber: order.trackNumber,
      carrier: order.trackingProvider ?? order.logisticName ?? null,
      trackingUrl: order.trackingUrl ?? universalTrackingUrl(order.trackNumber),
      delivered,
    };
  },

  async cancelOrder(externalOrderId) {
    // Possible uniquement tant que la commande CJ n'est pas payée (statuts CREATED / IN_CART).
    await request(
      `/shopping/order/deleteOrder?orderId=${encodeURIComponent(externalOrderId)}`,
      { method: "DELETE" },
      true,
    );
  },
};
