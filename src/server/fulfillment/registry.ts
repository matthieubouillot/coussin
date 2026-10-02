import "server-only";
import type { SupplierAdapterKind } from "@/generated/prisma/client";
import { aliexpressAdapter } from "@/server/fulfillment/adapters/aliexpress";
import { cjAdapter } from "@/server/fulfillment/adapters/cj";
import { manualAdapter } from "@/server/fulfillment/adapters/manual";
import type { SupplierAdapter } from "@/server/fulfillment/types";

const ADAPTERS: Record<SupplierAdapterKind, SupplierAdapter> = {
  ALIEXPRESS: aliexpressAdapter,
  CJ: cjAdapter,
  MANUAL: manualAdapter,
};

/** L'adaptateur est choisi par offre (chaque taille peut avoir plusieurs fournisseurs). */
export function getAdapter(kind: SupplierAdapterKind): SupplierAdapter {
  return ADAPTERS[kind];
}
