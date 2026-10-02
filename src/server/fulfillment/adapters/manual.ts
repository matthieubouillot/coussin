import "server-only";
import { SupplierError, type SupplierAdapter } from "@/server/fulfillment/types";

/**
 * Filet de sécurité : la commande apparaît dans l'admin avec un bouton « Passer chez le fournisseur » ;
 * l'admin saisit ensuite la référence fournisseur et le numéro de suivi.
 */
export const manualAdapter: SupplierAdapter = {
  kind: "MANUAL",
  async getProduct() {
    throw new SupplierError("NOT_SUPPORTED", "Fournisseur manuel : pas de catalogue");
  },
  async getStockAndPrice() {
    // Stock inconnu : considéré disponible ; le coût reste celui saisi dans l'admin.
    return { stock: null, unitCost: null, currency: "EUR" as const };
  },
  async placeOrder(request) {
    return {
      externalOrderId: `MANUEL-${request.reference}`,
      payment: "MANUAL" as const,
      totalCostCents: null,
    };
  },
  async getOrderStatus() {
    return "UNKNOWN" as const;
  },
  async getTracking() {
    return null;
  },
  async cancelOrder() {
    throw new SupplierError("NOT_SUPPORTED", "À annuler directement chez le fournisseur");
  },
};
