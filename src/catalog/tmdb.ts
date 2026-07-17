import type { Media } from "../types";

export interface TmdbCatalogEntry {
  providerId: number;
  mediaType: "movie" | "tv";
  posterUrl: string | null;
  backdropUrl: string | null;
  synopsis: string | null;
  runtime: number | null;
  year: number | null;
  genres: string[];
}

export interface TmdbCatalog {
  generatedAt: string | null;
  entries: Record<string, TmdbCatalogEntry>;
}

export function applyTmdbMetadata(
  item: Media,
  metadata?: TmdbCatalogEntry,
): Media {
  if (!metadata) return item;

  return {
    ...item,
    poster: metadata.posterUrl ?? item.poster,
    backdrop: metadata.backdropUrl ?? item.backdrop,
    synopsis: metadata.synopsis || item.synopsis,
    runtime:
      metadata.runtime && metadata.runtime > 0
        ? metadata.runtime
        : item.runtime,
    year: metadata.year ?? item.year,
    genres: metadata.genres.length > 0 ? metadata.genres : item.genres,
    provider: {
      name: "tmdb",
      id: metadata.providerId,
      mediaType: metadata.mediaType,
    },
  };
}
