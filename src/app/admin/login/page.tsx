import { LoginForm } from "@/components/admin/AuthForms";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-cocoa mb-6 font-serif text-2xl">Connexion</h1>
      <LoginForm />
    </main>
  );
}
