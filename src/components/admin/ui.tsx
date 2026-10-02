import type { ReactNode } from "react";

// Petits composants de présentation partagés par les écrans admin (aucune logique).

export function PageTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-cocoa font-serif text-2xl">{children}</h1>
      {actions}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-xl border border-stone-200 bg-white p-4">
      {title && <h2 className="mb-3 font-medium">{title}</h2>}
      {children}
    </section>
  );
}

export const inputClass = "mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm";
export const buttonClass =
  "rounded-md bg-cocoa px-4 py-2 text-sm font-medium text-white hover:bg-cocoa/90 disabled:opacity-60";
export const secondaryButtonClass =
  "rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-60";
export const dangerButtonClass =
  "rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-stone-500">{hint}</span>}
    </label>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  children: ReactNode;
}) {
  const styles = {
    info: "border-sky-200 bg-sky-50",
    warning: "border-amber-300 bg-amber-50",
    danger: "border-red-300 bg-red-50",
    success: "border-emerald-300 bg-emerald-50",
  }[tone];
  return <div className={`mb-4 rounded-md border p-3 text-sm ${styles}`}>{children}</div>;
}
