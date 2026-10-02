import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapAliExpressStatus, signAliExpress } from "@/server/fulfillment/adapters/aliexpress-protocol";
import { mapCjStatus } from "@/server/fulfillment/adapters/cj-protocol";
import { decimalToCents } from "@/server/fulfillment/money";

describe("signature AliExpress", () => {
  it("HMAC-SHA256 des paramètres triés, en hexadécimal majuscule", () => {
    const params = { timestamp: "1", app_key: "k", method: "aliexpress.ds.product.get" };
    const expected = createHmac("sha256", "secret")
      .update("app_keykmethodaliexpress.ds.product.gettimestamp1")
      .digest("hex")
      .toUpperCase();
    expect(signAliExpress(params, "secret")).toBe(expected);
  });

  it("préfixe le chemin pour les routes /rest (jetons)", () => {
    const expected = createHmac("sha256", "s")
      .update("/auth/token/refreshapp_keyk")
      .digest("hex")
      .toUpperCase();
    expect(signAliExpress({ app_key: "k" }, "s", "/auth/token/refresh")).toBe(expected);
  });
});

describe("statuts fournisseurs normalisés", () => {
  it("AliExpress", () => {
    expect(mapAliExpressStatus("PLACE_ORDER_SUCCESS", undefined)).toBe("AWAITING_PAYMENT");
    expect(mapAliExpressStatus("WAIT_SELLER_SEND_GOODS", "WAIT_SELLER_SEND_GOODS")).toBe("PROCESSING");
    expect(mapAliExpressStatus("WAIT_BUYER_ACCEPT_GOODS", "SELLER_SEND_GOODS")).toBe("SHIPPED");
    expect(mapAliExpressStatus("WAIT_BUYER_ACCEPT_GOODS", "BUYER_ACCEPT_GOODS")).toBe("DELIVERED");
    expect(mapAliExpressStatus("IN_CANCEL", undefined)).toBe("CANCELLED");
    expect(mapAliExpressStatus("STATUT_INCONNU", undefined)).toBe("UNKNOWN");
  });

  it("CJ", () => {
    expect(mapCjStatus("UNPAID")).toBe("AWAITING_PAYMENT");
    expect(mapCjStatus("UNSHIPPED")).toBe("PROCESSING");
    expect(mapCjStatus("SHIPPED")).toBe("SHIPPED");
    expect(mapCjStatus("DELIVERED")).toBe("DELIVERED");
    expect(mapCjStatus(null)).toBe("UNKNOWN");
  });
});

it("convertit les montants décimaux en centimes", () => {
  expect(decimalToCents("5,79")).toBe(579);
  expect(decimalToCents(3)).toBe(300);
  expect(decimalToCents("")).toBeNull();
  expect(decimalToCents("abc")).toBeNull();
});
