import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdminOrNull } from "@/server/auth/require-admin";
import { env } from "@/server/env";

// Jetons d'envoi direct navigateur → Vercel Blob, délivrés uniquement à l'admin authentifié.
// Type et taille sont imposés dans le jeton : Vercel Blob refuse tout autre fichier.
const MEDIA_RULES = {
  image: { types: ["image/jpeg", "image/png", "image/webp", "image/avif"], maxBytes: 8 * 1024 * 1024 },
  video: { types: ["video/mp4", "video/webm"], maxBytes: 80 * 1024 * 1024 },
} as const;

export async function POST(request: Request): Promise<Response> {
  const admin = await getAdminOrNull();
  if (!admin) return new Response("Introuvable", { status: 404 });
  if (!env().BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "Stockage non configuré (BLOB_READ_WRITE_TOKEN)" }, { status: 503 });
  }

  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^produit\/[a-z0-9-]+\.(jpe?g|png|webp|avif|mp4|webm)$/i.test(pathname)) {
          throw new Error("Nom de fichier refusé");
        }
        const isVideo = /\.(mp4|webm)$/i.test(pathname);
        const rule = isVideo ? MEDIA_RULES.video : MEDIA_RULES.image;
        return {
          allowedContentTypes: [...rule.types],
          maximumSizeInBytes: rule.maxBytes,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Envoi refusé" }, { status: 400 });
  }
}
