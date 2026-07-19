import { useState } from "react";

interface PosterProps {
  src?: string;
  alt: string;
  ratio?: "2/3" | "16/9";
  pill?: string;
}

export function Poster({ src, alt, ratio = "2/3", pill }: PosterProps) {
  const [loaded, setLoaded] = useState(false);
  const ratioClass = ratio === "16/9" ? "poster-16x9" : "poster-2x3";
  return (
    <div className={`poster ${ratioClass}`}>
      {src ? (
        <img
          className={loaded ? "poster-img is-loaded" : "poster-img"}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <div className="poster-empty" role="img" aria-label={alt} />
      )}
      {src && !loaded && <div className="poster-skeleton" aria-hidden="true" />}
      {pill && <span className="poster-pill">{pill}</span>}
    </div>
  );
}
