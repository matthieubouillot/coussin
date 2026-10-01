"use server";

import { clearCart } from "@/server/cart/cart";

export async function clearCartAction(): Promise<void> {
  await clearCart();
}
