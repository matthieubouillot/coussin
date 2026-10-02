"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { registerMediaAction } from "@/app/admin/(protected)/produit/actions";
import { buttonClass, Field, inputClass } from "@/components/admin/ui";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm";

function slugify(name: string): string {
  const [base = "media", ext = ""] = [name.replace(/\.[^.]+$/, ""), name.split(".").pop()?.toLowerCase()];
  const clean = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${clean || "media"}.${ext}`;
}

/** Dimensions réelles du fichier, lues dans le navigateur (évite tout décalage de mise en page). */
function readDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = reject;
      video.src = url;
    } else {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
    }
  }).finally(() => URL.revokeObjectURL(url)) as Promise<{ width: number; height: number }>;
}

export function MediaUploader({ productId }: { productId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    const alt = (form.elements.namedItem("alt") as HTMLInputElement).value;
    if (!file) return;
    setPending(true);
    setMessage(null);
    try {
      const { width, height } = await readDimensions(file);
      const blob = await upload(`produit/${slugify(file.name)}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/media-upload",
        contentType: file.type,
      });
      const result = await registerMediaAction({
        productId,
        url: blob.url,
        kind: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
        width,
        height,
        alt,
      });
      setMessage(result?.message ?? null);
      if (result?.ok) form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Envoi impossible");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field
        label="Fichier"
        hint="Images JPEG/PNG/WebP/AVIF ≤ 8 Mo, vidéos MP4/WebM ≤ 80 Mo (compressées de préférence)."
      >
        <input name="file" type="file" required accept={ACCEPT} className={inputClass} />
      </Field>
      <Field label="Texte alternatif (accessibilité)" hint="Décrivez ce que montre l'image.">
        <input name="alt" required minLength={3} maxLength={200} className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Envoi…" : "Ajouter le média"}
      </button>
      <p aria-live="polite" className="text-sm">
        {message}
      </p>
    </form>
  );
}
