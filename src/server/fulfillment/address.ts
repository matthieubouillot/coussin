import type { ShippingAddress } from "@/server/fulfillment/types";

/**
 * L'API AliExpress n'accepte que des caractères latins sans accents : « Hélène Lefèvre, 3 rue de
 * l'Église » devient « Helene Lefevre, 3 rue de l'Eglise ». Ligatures et caractères spéciaux sont
 * remplacés, tout autre caractère non ASCII est retiré.
 */
export function toPlainLatin(input: string): string {
  return (
    input
      .replace(/œ/g, "oe")
      .replace(/Œ/g, "OE")
      .replace(/æ/g, "ae")
      .replace(/Æ/g, "AE")
      .replace(/ß/g, "ss")
      // Lettres sans décomposition Unicode (NFD ne les sépare pas de leur accent).
      .replace(/ø/g, "o")
      .replace(/Ø/g, "O")
      .replace(/ł/g, "l")
      .replace(/Ł/g, "L")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[’‘`´]/g, "'")
      .replace(/[–—]/g, "-")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Téléphone français au format international (+33…). Retourne null si le numéro est inexploitable. */
export function normalizeFrenchPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+33[1-9]\d{8}$/.test(digits)) return digits;
  if (/^0033[1-9]\d{8}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^0[1-9]\d{8}$/.test(digits)) return `+33${digits.slice(1)}`;
  return null;
}

export function buildShippingAddress(order: {
  shippingName: string | null;
  shippingLine1: string | null;
  shippingLine2: string | null;
  shippingPostalCode: string | null;
  shippingCity: string | null;
  phone: string | null;
}): ShippingAddress | null {
  const phone = normalizeFrenchPhone(order.phone);
  if (
    !order.shippingName ||
    !order.shippingLine1 ||
    !order.shippingPostalCode ||
    !order.shippingCity ||
    !phone
  )
    return null;
  return {
    fullName: order.shippingName,
    line1: order.shippingLine1,
    line2: order.shippingLine2,
    postalCode: order.shippingPostalCode,
    city: order.shippingCity,
    countryCode: "FR",
    phone,
  };
}
