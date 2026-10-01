import { describe, expect, it } from "vitest";
import { addItem, decodeCart, EMPTY_CART, encodeCart, setQuantity } from "@/server/cart/cart-cookie";

const SECRET = "test-secret";

describe("cookie panier signé", () => {
  it("aller-retour encode/decode", () => {
    const cart = { v: 1 as const, items: [{ variantId: "m", quantity: 2 }], promoCode: "NOEL" };
    expect(decodeCart(encodeCart(cart, SECRET), SECRET)).toEqual(cart);
  });

  it("rejette un cookie altéré, signé avec une autre clé ou malformé", () => {
    const raw = encodeCart({ v: 1, items: [{ variantId: "m", quantity: 1 }] }, SECRET);
    const [payload, sig] = raw.split(".");
    const forged = Buffer.from(JSON.stringify({ v: 1, items: [{ variantId: "m", quantity: 9 }] })).toString(
      "base64url",
    );
    expect(decodeCart(`${forged}.${sig}`, SECRET)).toEqual(EMPTY_CART);
    expect(decodeCart(raw, "autre-cle")).toEqual(EMPTY_CART);
    expect(decodeCart(`${payload}`, SECRET)).toEqual(EMPTY_CART);
    expect(decodeCart("n'importe quoi", SECRET)).toEqual(EMPTY_CART);
  });

  it("rejette un contenu signé mais hors limites (quantité 50)", () => {
    const raw = encodeCart({ v: 1, items: [{ variantId: "m", quantity: 50 }] }, SECRET);
    expect(decodeCart(raw, SECRET)).toEqual(EMPTY_CART);
  });

  it("cumule les quantités et plafonne à 10 par ligne", () => {
    let cart = addItem(EMPTY_CART, "m", 4);
    cart = addItem(cart, "m", 9);
    expect(cart.items).toEqual([{ variantId: "m", quantity: 10 }]);
  });

  it("quantité 0 supprime la ligne", () => {
    const cart = setQuantity(addItem(EMPTY_CART, "m", 2), "m", 0);
    expect(cart.items).toEqual([]);
  });
});
