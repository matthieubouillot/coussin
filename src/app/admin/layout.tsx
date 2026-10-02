import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="text-ink min-h-dvh bg-stone-50">{children}</div>;
}
