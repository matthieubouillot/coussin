import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { env } from "@/server/env";

/**
 * Stockage de fichiers privés (factures PDF).
 * En ligne : Vercel Blob en accès privé (jamais d'URL publique). En dev sans jeton : dossier local
 * `.data/private` (ignoré par Git). La clé retournée est le chemin logique du fichier.
 */

// LOCAL_DATA_DIR permet aux tests d'isoler leurs fichiers ; jamais utilisé en ligne (Blob).
const LOCAL_ROOT = path.join(process.env.LOCAL_DATA_DIR ?? path.join(process.cwd(), ".data"), "private");

function localPath(key: string): string {
  const resolved = path.resolve(LOCAL_ROOT, key);
  // Empêche toute sortie du dossier (clé du type « ../../etc/passwd »).
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Clé de stockage invalide");
  return resolved;
}

export async function putPrivateFile(key: string, bytes: Buffer, contentType: string): Promise<string> {
  const token = env().BLOB_READ_WRITE_TOKEN;
  if (token) {
    await put(key, bytes, {
      access: "private",
      contentType,
      token,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    return key;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: "wx" });
  return key;
}

export async function getPrivateFile(key: string): Promise<Buffer | null> {
  const token = env().BLOB_READ_WRITE_TOKEN;
  if (token) {
    const result = await get(key, { access: "private", token });
    if (!result || !result.stream) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  try {
    return await readFile(localPath(key));
  } catch {
    return null;
  }
}
