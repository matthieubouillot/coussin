import { formatEuros } from "@/lib/money";

type DescribableBundle = {
  kind: "QUANTITY" | "COMBO";
  minQuantity: number | null;
  comboVariantIds: string[];
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
};

function discountText(b: DescribableBundle): string {
  if (b.discountType === "PERCENT") {
    const percent = b.discountValue / 100;
    return `−${Number.isInteger(percent) ? percent : percent.toFixed(1).replace(".", ",")} %`;
  }
  return `−${formatEuros(b.discountValue)}`;
}

/** Phrase affichée au client pour une offre par lot (texte factuel, sans urgence artificielle). */
export function describeBundle(b: DescribableBundle, variantLabels: Map<string, string>): string | null {
  if (b.kind === "QUANTITY") {
    if (!b.minQuantity) return null;
    return `Dès ${b.minQuantity} coussins dans le panier : ${discountText(b)} sur les articles`;
  }
  const names = b.comboVariantIds.map((id) => variantLabels.get(id));
  if (names.length === 0 || names.some((n) => !n)) return null;
  return `${names.join(" + ")} achetés ensemble : ${discountText(b)}`;
}
