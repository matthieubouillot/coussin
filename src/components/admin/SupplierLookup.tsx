"use client";

import { useActionState } from "react";
import { lookupSupplierProductAction } from "@/app/admin/(protected)/produit/actions";
import { Field, inputClass, secondaryButtonClass } from "@/components/admin/ui";

/** Aide à la saisie : affiche les variantes d'un produit chez le fournisseur et leur identifiant. */
export function SupplierLookup() {
  const [state, action, pending] = useActionState(lookupSupplierProductAction, null);
  return (
    <form action={action} className="space-y-2 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Fournisseur">
          <select name="adapter" className={inputClass}>
            <option value="ALIEXPRESS">AliExpress</option>
            <option value="CJ">CJ</option>
          </select>
        </Field>
        <Field label="ID produit (AliExpress) ou pid (CJ)">
          <input name="productId" required className={inputClass} />
        </Field>
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          Voir les variantes
        </button>
      </div>
      {state && <p className={state.ok ? "" : "text-red-700"}>{state.message}</p>}
      {state?.variants && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left">
              <th>Variante</th>
              <th>ID à copier dans l&apos;offre</th>
              <th>Stock</th>
              <th>Coût</th>
            </tr>
          </thead>
          <tbody>
            {state.variants.map((v) => (
              <tr key={v.skuId}>
                <td>{v.label}</td>
                <td className="font-mono select-all">{v.skuId}</td>
                <td>{v.stock ?? "?"}</td>
                <td>{v.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </form>
  );
}
