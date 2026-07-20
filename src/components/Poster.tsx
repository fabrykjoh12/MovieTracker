import { useState } from "react";

interface PosterProps {
  src?: string;
  alt: string;
  ratio?: "2/3" | "16/9";
  pill?: string;
}

export function Poster({ src, alt, ratio = "2/3", pill }: PosterProps) {
  // Track which src has loaded (not just a boolean) so a changed src re-shows
  // the skeleton, and seed from `complete` so already-cached images — whose
  // `onLoad` may never fire — are not stuck invisible at opacity 0.
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>(undefined);
  const ratioClass = ratio === "16/9" ? "poster-16x9" : "poster-2x3";
  const loaded = Boolean(src) && loadedSrc === src;
  return (
    <div className={`poster ${ratioClass}`}>
      {src ? (
        <img
          className={loaded ? "poster-img is-loaded" : "poster-img"}
          src={src}
          alt={alt}
          loading="lazy"
          ref={(node) => {
            if (node?.complete && node.naturalWidth > 0) setLoadedSrc(src);
          }}
          onLoad={() => setLoadedSrc(src)}
        />
      ) : (
        <div className="poster-empty" role="img" aria-label={alt} />
      )}
      {src && !loaded && <div className="poster-skeleton" aria-hidden="true" />}
      {pill && <span className="poster-pill">{pill}</span>}
    </div>
  );
}
