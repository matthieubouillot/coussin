import { z } from "zod";
import { audit } from "@/server/audit/audit";
import { getAdminOrNull } from "@/server/auth/require-admin";
import { exportCustomerData } from "@/server/gdpr/customers";

// Export RGPD (droit d'accès) au format JSON, à transmettre au client qui en fait la demande.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/admin/clients/[id]/export">,
): Promise<Response> {
  const admin = await getAdminOrNull();
  if (!admin) return new Response("Introuvable", { status: 404 });
  const id = z
    .string()
    .min(1)
    .max(64)
    .safeParse((await params).id);
  if (!id.success) return new Response("Introuvable", { status: 404 });

  const data = await exportCustomerData(id.data);
  await audit("customer.export", { actorId: admin.id, targetType: "customer", targetId: id.data });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="donnees-client-${id.data}.json"`,
      "cache-control": "no-store",
    },
  });
}
