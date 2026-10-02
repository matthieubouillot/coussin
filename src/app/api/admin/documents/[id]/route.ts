import { z } from "zod";
import { audit } from "@/server/audit/audit";
import { getAdminOrNull } from "@/server/auth/require-admin";
import { db } from "@/server/db";
import { ensureInvoicePdf } from "@/server/invoices/issue-invoice";

// Téléchargement d'une facture ou d'un avoir (PDF privé) : réservé à l'admin authentifié.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/admin/documents/[id]">,
): Promise<Response> {
  const admin = await getAdminOrNull();
  if (!admin) return new Response("Introuvable", { status: 404 });

  const id = z
    .string()
    .min(1)
    .max(64)
    .safeParse((await params).id);
  if (!id.success) return new Response("Introuvable", { status: 404 });
  const invoice = await db.invoice.findUnique({ where: { id: id.data }, select: { id: true, number: true } });
  if (!invoice) return new Response("Introuvable", { status: 404 });

  const { bytes } = await ensureInvoicePdf(invoice.id);
  await audit("document.download", { actorId: admin.id, targetType: "invoice", targetId: invoice.id });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${invoice.number}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
