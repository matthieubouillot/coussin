import Image from "next/image";

type Media = {
  id: string;
  kind: "IMAGE" | "VIDEO";
  blobUrl: string;
  posterUrl: string | null;
  alt: string;
  width: number;
  height: number;
};

export function ProductGallery({ media, productName }: { media: Media[]; productName: string }) {
  if (media.length === 0) {
    // Aucune photo de démonstration : tant que les vraies photos ne sont pas en ligne, on le dit.
    return (
      <div className="text-ink/75 flex aspect-square items-center justify-center rounded-3xl bg-white p-8 text-center">
        <p>
          Photos de {productName.toLowerCase()} bientôt disponibles.
          <span className="sr-only"> Aucune image pour le moment.</span>
        </p>
      </div>
    );
  }

  const [first, ...rest] = media;
  return (
    <div className="space-y-3">
      {first && <MediaItem media={first} priority />}
      {rest.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {rest.map((m) => (
            <MediaItem key={m.id} media={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaItem({ media, priority = false }: { media: Media; priority?: boolean }) {
  if (media.kind === "VIDEO") {
    // preload="none" : la vidéo n'est téléchargée que si le visiteur la lance (performance mobile).
    return (
      <video
        controls
        muted
        playsInline
        preload="none"
        poster={media.posterUrl ?? undefined}
        width={media.width}
        height={media.height}
        className="w-full rounded-3xl bg-white"
        aria-label={media.alt}
      >
        <source src={media.blobUrl} />
      </video>
    );
  }
  return (
    <Image
      src={media.blobUrl}
      alt={media.alt}
      width={media.width}
      height={media.height}
      priority={priority}
      sizes="(min-width: 1024px) 50vw, 100vw"
      className="w-full rounded-3xl bg-white object-cover"
    />
  );
}
