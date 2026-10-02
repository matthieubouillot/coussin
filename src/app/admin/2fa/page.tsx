import { TwoFactorForm } from "@/components/admin/AuthForms";

export default function AdminTwoFactorPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-cocoa mb-6 font-serif text-2xl">Double authentification</h1>
      <TwoFactorForm />
    </main>
  );
}
