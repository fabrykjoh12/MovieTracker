import type { Media } from "../types";

export const localCatalogKey = "movietracker:catalog:v1";

type CatalogStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isMedia(value: unknown): value is Media {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Media>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    (item.format === "movie" || item.format === "series") &&
    typeof item.poster === "string" &&
    typeof item.backdrop === "string" &&
    typeof item.runtime === "number" &&
    Array.isArray(item.genres) &&
    Array.isArray(item.moods) &&
    typeof item.synopsis === "string" &&
    item.provider?.name === "tmdb"
  );
}

export function mergeCatalogs(...catalogs: Media[][]) {
  const entries = new Map<string, Media>();
  catalogs.flat().forEach((item) => entries.set(item.id, item));
  return Array.from(entries.values());
}

export function createLocalCatalogRepository(
  storage: CatalogStorage = window.localStorage,
  key = localCatalogKey,
) {
  return {
    load() {
      try {
        const raw = storage.getItem(key);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isMedia) : [];
      } catch {
        return [];
      }
    },
    save(catalog: Media[]) {
      storage.setItem(
        key,
        JSON.stringify(catalog.filter((item) => item.id.startsWith("tmdb-"))),
      );
    },
    clear() {
      storage.removeItem(key);
    },
  };
}
