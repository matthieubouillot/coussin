import type { SupplierAdapterKind } from "@/generated/prisma/client";

/**
 * Contrat commun à tous les fournisseurs (cahier des charges §5.1).
 * Chaque adaptateur valide par Zod les réponses de l'API fournisseur : aucune confiance aveugle.
 */

export type OfferRef = {
  externalProductId: string | null;
  externalSkuId: string | null;
  shippingMethod: string | null;
};

export type ShippingAddress = {
  fullName: string;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  countryCode: "FR";
  /** Format international, ex. +33612345678. */
  phone: string;
};

export type PlaceOrderRequest = {
  /** Notre référence unique (identifiant de la commande fournisseur) : sert de clé d'idempotence. */
  reference: string;
  offer: OfferRef;
  quantity: number;
  address: ShippingAddress;
};

export type PlaceOrderResult = {
  externalOrderId: string;
  /** PAID : payée chez le fournisseur ; AWAITING_PAYMENT : à payer par l'admin ; MANUAL : à passer à la main. */
  payment: "PAID" | "AWAITING_PAYMENT" | "MANUAL";
  /** Coût total réellement facturé par le fournisseur, en centimes d'euro, s'il est connu. */
  totalCostCents: number | null;
};

export type SupplierOrderState =
  "AWAITING_PAYMENT" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "UNKNOWN";

export type Tracking = {
  trackingNumber: string;
  carrier: string | null;
  trackingUrl: string | null;
  delivered: boolean;
};

export type StockAndPrice = {
  stock: number | null;
  /** Coût unitaire dans la devise du fournisseur, en centimes. */
  unitCost: number | null;
  currency: "EUR" | "USD";
};

export type SupplierProductVariant = {
  skuId: string;
  label: string;
  stock: number | null;
  unitCost: number | null;
  currency: string;
};

export interface SupplierAdapter {
  readonly kind: SupplierAdapterKind;
  getProduct(externalProductId: string): Promise<{ title: string; variants: SupplierProductVariant[] }>;
  getStockAndPrice(offer: OfferRef): Promise<StockAndPrice>;
  placeOrder(request: PlaceOrderRequest): Promise<PlaceOrderResult>;
  getOrderStatus(externalOrderId: string): Promise<SupplierOrderState>;
  getTracking(externalOrderId: string): Promise<Tracking | null>;
  cancelOrder(externalOrderId: string): Promise<void>;
}

/**
 * Erreurs fournisseur classées : la suite (réessai, bascule, vérification manuelle) en dépend.
 * - TRANSIENT : refus explicite et temporaire (quota, 5xx) → réessai avec délai croissant.
 * - OUT_OF_STOCK : rupture → bascule immédiate sur l'offre suivante.
 * - PERMANENT : refus définitif (adresse, produit retiré) → bascule.
 * - AMBIGUOUS : on ne sait pas si la commande a été créée (délai dépassé) → JAMAIS de réessai auto.
 * - NOT_CONFIGURED / NOT_SUPPORTED : traitement manuel.
 */
export type SupplierErrorKind =
  "TRANSIENT" | "OUT_OF_STOCK" | "PERMANENT" | "AMBIGUOUS" | "NOT_CONFIGURED" | "NOT_SUPPORTED";

export class SupplierError extends Error {
  constructor(
    readonly kind: SupplierErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SupplierError";
  }
}
