import { ImageResponse } from "next/og";
import { getMainProduct } from "@/server/catalog/catalog";
import { getShopConfig } from "@/server/settings/settings";

// Image de partage (réseaux sociaux) générée tant qu'aucune photo produit n'est en ligne.
export const alt = "Coussin auto-chauffant pour chats et chiens, sans électricité";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [product, config] = await Promise.all([getMainProduct(), getShopConfig()]);
  const minPrice = product ? Math.min(...product.variants.map((v) => v.priceCents)) : null;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#f7f3ec",
        color: "#2b2420",
      }}
    >
      <div style={{ fontSize: 30, color: "#5f7360" }}>
        {config.shopName.includes("[À COMPLÉTER") ? "" : config.shopName}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 68, fontWeight: 700, color: "#6b4a35", lineHeight: 1.1 }}>
          {product?.name ?? "Coussin auto-chauffant"}
        </div>
        <div style={{ fontSize: 34 }}>
          {product?.tagline ?? "Votre animal au chaud tout l'hiver, sans électricité."}
        </div>
      </div>
      <div style={{ fontSize: 30, display: "flex", gap: 32 }}>
        {minPrice !== null && <span>Dès {(minPrice / 100).toFixed(2).replace(".", ",")} €</span>}
        <span>Sans prise ni batterie</span>
        <span>Lavable en machine</span>
      </div>
    </div>,
    size,
  );
}
