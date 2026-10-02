import { redirect } from "next/navigation";
import { EnrollmentForm } from "@/components/admin/AuthForms";
import { adminHref } from "@/server/auth/admin-path";
import { requireAdminPendingTwoFactor } from "@/server/auth/require-admin";

export default async function EnrollTwoFactorPage() {
  const admin = await requireAdminPendingTwoFactor();
  if (admin.twoFactorEnabled) redirect(adminHref());
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-cocoa mb-6 font-serif text-2xl">Activer la double authentification</h1>
      <EnrollmentForm />
    </main>
  );
}
